
"use strict";

const MAX_CACHED_RESPONSES = 64;

export function createAvailabilityRequestManager({
    load,
    concurrency = 3,
    ttlMs = 30_000,
    onTiming
}) {
    if (
        typeof load !== "function" ||
        !Number.isInteger(concurrency) ||
        concurrency < 1 ||
        !Number.isFinite(ttlMs) ||
        ttlMs < 0
    ) {
        throw new TypeError("Invalid request manager configuration.");
    }

    const pending = new Map();
    const cache = new Map();
    const queue = [];
    let activeCount = 0;

    function report(data) {
        if (typeof onTiming !== "function") return;
        Promise.resolve()
            .then(() => onTiming(data))
            .catch(() => {});
    }

    function settle(entry, subscriber, outcome, value) {
        subscriber.signal?.removeEventListener(
            "abort",
            subscriber.abort
        );

        const now = performance.now();
        const started = entry.startedAt ?? now;

        report({
            key: entry.key,
            source: subscriber.source,
            outcome,
            waitMs: Math.max(
                0,
                Math.max(started, subscriber.requestedAt) -
                    subscriber.requestedAt
            ),
            requestMs: Math.max(
                0,
                now - Math.max(started, subscriber.requestedAt)
            )
        });

        if (outcome === "success") subscriber.resolve(value);
        else subscriber.reject(value);
    }

    function remember(key, value) {
        if (!ttlMs) return;

        cache.delete(key);
        cache.set(key, {
            value,
            expiresAt: performance.now() + ttlMs
        });

        while (cache.size > MAX_CACHED_RESPONSES) {
            cache.delete(cache.keys().next().value);
        }
    }

    function drain() {
        while (activeCount < concurrency && queue.length) {
            const entry = queue.shift();

            if (
                pending.get(entry.key) !== entry ||
                !entry.subscribers.size
            ) {
                continue;
            }

            entry.startedAt = performance.now();
            activeCount++;

            Promise.resolve()
                .then(() => {
                    entry.controller.signal.throwIfAborted();
                    return load(entry.input, {
                        signal: entry.controller.signal
                    });
                })
                .then(
                    value => finish(entry, "success", value),
                    error => finish(entry, "error", error)
                );
        }
    }

    function finish(entry, outcome, value) {
        activeCount--;

        if (pending.get(entry.key) === entry) {
            pending.delete(entry.key);

            if (outcome === "success") {
                remember(entry.key, value);
            }

            for (const subscriber of entry.subscribers) {
                settle(entry, subscriber, outcome, value);
            }

            entry.subscribers.clear();
        }

        drain();
    }

    function cancelSubscriber(entry, subscriber) {
        if (!entry.subscribers.delete(subscriber)) return;

        if (
            !entry.subscribers.size &&
            pending.get(entry.key) === entry
        ) {
            pending.delete(entry.key);

            if (entry.startedAt === undefined) {
                const index = queue.indexOf(entry);
                if (index >= 0) queue.splice(index, 1);
            }

            entry.controller.abort();
        }

        settle(
            entry,
            subscriber,
            "aborted",
            subscriber.signal?.reason ??
                new DOMException("Aborted", "AbortError")
        );

        drain();
    }

    function get(key, input, { signal } = {}) {
        if (signal?.aborted) {
            return Promise.reject(signal.reason);
        }

        const cached = cache.get(key);
        cache.delete(key);

        if (cached && cached.expiresAt > performance.now()) {
            cache.set(key, cached);
            report({
                key,
                source: "cache",
                outcome: "success",
                waitMs: 0,
                requestMs: 0
            });
            return Promise.resolve(cached.value);
        }

        let entry = pending.get(key);
        const source = entry ? "shared" : "network";

        if (!entry) {
            entry = {
                key,
                input,
                controller: new AbortController(),
                subscribers: new Set()
            };
            pending.set(key, entry);
            queue.push(entry);
        }

        const result = new Promise((resolve, reject) => {
            const subscriber = {
                resolve,
                reject,
                signal,
                source,
                requestedAt: performance.now()
            };

            subscriber.abort = () =>
                cancelSubscriber(entry, subscriber);

            entry.subscribers.add(subscriber);

            signal?.addEventListener(
                "abort",
                subscriber.abort,
                { once: true }
            );
        });

        drain();
        return result;
    }

    function clear() {
        cache.clear();

        const entries = [...pending.values()];
        pending.clear();
        queue.length = 0;

        for (const entry of entries) {
            entry.controller.abort();

            for (const subscriber of entry.subscribers) {
                settle(
                    entry,
                    subscriber,
                    "aborted",
                    entry.controller.signal.reason ??
                        new DOMException("Aborted", "AbortError")
                );
            }

            entry.subscribers.clear();
        }
    }

    return { get, clear };
}
