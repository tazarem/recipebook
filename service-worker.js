(() => {
    class RecipeBookWebCache {
        constructor() {
            // 앱 파일을 바꾸면 버전을 올려야 사용자 기기의 캐시가 갱신됩니다.
            this.STATIC_CACHE_NAME = 'recipebook_static_v0.66'
            this.DYNAMIC_CACHE_NAME = 'recipebook_dynamic_v0.66'
            this.STATIC_CACHE_LIST = [
                './',
                './index.html',
                './manifest.json',
                './config.js',
                './css/recipe.css',
                './store/idb.js',
                './js/ui.js',
                './js/tag-input.js',
                './js/recipe.js',
                './js/shopping.js',
                './js/meal.js',
                './js/init.js',
                './img/icons/icon-192.png',
                './img/icons/icon-512.png',
                './img/icons/favicon-32.png',
                './lib/css/fontawesome5/all.min.css',
                './lib/css/webfonts/fa-solid-900.woff2',
                './lib/css/webfonts/fa-regular-400.woff2',
            ]
            this.init()
        }

        init() {
            self.addEventListener('install', this.staticCacheStrategy.bind(this))
            self.addEventListener('activate', this.deleteOldCache.bind(this))
            self.addEventListener('fetch', this.dynamicCacheStrategy.bind(this))
        }

        // 설치 시 앱 셸을 미리 캐시
        staticCacheStrategy(e) {
            e.waitUntil((async () => {
                const static_cache = await caches.open(this.STATIC_CACHE_NAME)
                await static_cache.addAll(this.STATIC_CACHE_LIST)
                await self.skipWaiting()
            })())
        }

        // 이전 버전 캐시 삭제
        deleteOldCache(e) {
            const cache_white_list = [this.STATIC_CACHE_NAME, this.DYNAMIC_CACHE_NAME]
            e.waitUntil((async () => {
                const cache_names = await caches.keys()
                await Promise.all(
                    cache_names
                        .filter(name => !cache_white_list.includes(name))
                        .map(name => caches.delete(name))
                )
                await self.clients.claim()
            })())
        }

        // 캐시 우선 + 백그라운드 갱신(stale-while-revalidate)
        dynamicCacheStrategy(e) {
            if (e.request.method !== 'GET') return
            if (!e.request.url.startsWith('http')) return

            e.respondWith((async () => {
                const matched_response = await caches.match(e.request, { ignoreSearch: e.request.mode === 'navigate' })

                const network_fetch = fetch(e.request.clone())
                    .then(async (fetched_response) => {
                        if (fetched_response && (fetched_response.ok || fetched_response.type === 'opaque')) {
                            const dynamic_cache = await caches.open(this.DYNAMIC_CACHE_NAME)
                            await dynamic_cache.put(e.request, fetched_response.clone()).catch(() => {})
                        }
                        return fetched_response
                    })
                    .catch(() => null)

                if (matched_response) {
                    e.waitUntil(network_fetch)
                    return matched_response
                }

                const fetched_response = await network_fetch
                if (fetched_response) return fetched_response

                // 오프라인에서 페이지 이동이면 앱 셸로 대체
                if (e.request.mode === 'navigate') {
                    return caches.match('./index.html')
                }
                return new Response('', { status: 504, statusText: 'offline' })
            })())
        }
    }

    new RecipeBookWebCache()
})()
