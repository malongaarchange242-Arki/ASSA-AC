(function () {
    const rawFetch = window.fetch.bind(window);
    const memoryCache = new Map();
    const pendingRequests = new Map();
    const metrics = {
        hits: 0,
        misses: 0,
        networkRequests: 0
    };

    const TTL = {
        company: 5 * 60 * 1000,
        invoices: 60 * 1000,
        messages: 30 * 1000,
        proof: 5 * 60 * 1000
    };

    function getScope() {
        const token = localStorage.getItem('jwtTokenCompany') || '';
        const companyId = localStorage.getItem('id_companie') || 'unknown';
        let subject = companyId;
        try {
            subject = JSON.parse(atob(token.split('.')[1])).id || companyId;
        } catch {}
        return `company:${subject}`;
    }

    function storageKey(key) {
        return `assa-ac-cache:${getScope()}:${key}`;
    }

    function read(key) {
        const now = Date.now();
        const memoryEntry = memoryCache.get(storageKey(key));
        if (memoryEntry && memoryEntry.expiresAt > now) {
            metrics.hits += 1;
            return memoryEntry.value;
        }

        try {
            const stored = JSON.parse(sessionStorage.getItem(storageKey(key)) || 'null');
            if (stored && stored.expiresAt > now) {
                memoryCache.set(storageKey(key), stored);
                metrics.hits += 1;
                return stored.value;
            }
        } catch (error) {
            console.warn('Unable to read company cache:', error);
        }
        return null;
    }

    function write(key, value, ttl) {
        const entry = { value, expiresAt: Date.now() + ttl };
        memoryCache.set(storageKey(key), entry);
        try {
            sessionStorage.setItem(storageKey(key), JSON.stringify(entry));
        } catch (error) {
            console.warn('Unable to persist company cache:', error);
        }
        return value;
    }

    async function getJson(key, url, options, ttl) {
        const cached = read(key);
        if (cached !== null) return cached;

        const scopedKey = storageKey(key);
        if (pendingRequests.has(scopedKey)) return pendingRequests.get(scopedKey);

        metrics.misses += 1;
        metrics.networkRequests += 1;
        const request = rawFetch(url, options)
            .then(async response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const payload = await response.json();
                return write(key, payload, ttl);
            })
            .finally(() => pendingRequests.delete(scopedKey));

        pendingRequests.set(scopedKey, request);
        return request;
    }

    function invalidate(...keys) {
        keys.forEach(key => {
            const scopedKey = storageKey(key);
            memoryCache.delete(scopedKey);
            try {
                sessionStorage.removeItem(scopedKey);
            } catch (error) {
                console.warn('Unable to invalidate company cache:', error);
            }
        });
    }

    window.companyCache = {
        TTL,
        getJson,
        invalidate,
        metrics
    };

    window.fetch = function (input, options) {
        const requestUrl = typeof input === 'string' ? input : input.url;
        const method = (options?.method || input?.method || 'GET').toUpperCase();
        const shouldCache = method === 'GET' && /\/api\/(companies\/me|factures(?:\/company)?(?:\?|$))/.test(requestUrl);
        if (!shouldCache) return rawFetch(input, options);

        const key = requestUrl.includes('/companies/me') ? 'company' : 'invoices';
        return getJson(key, requestUrl, options, TTL[key]).then(payload => new Response(
            JSON.stringify(payload),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));
    };
})();
