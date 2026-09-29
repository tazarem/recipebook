/**
 * IndexedDB Client - RecipeBook
 * 파티노트 IndexedDBClient 구조를 따르되, 태그 검색용 multiEntry 인덱스를 씁니다.
 */
class IndexedDBClient {
    db
    DATABASE_NAME = APP_CONFIG.app_alias
    DATABASE_VERSION = 3 // v2: category 인덱스, v3: shopping(장바구니) 테이블
    TABLE_LIST = [
        {
            name: 'recipe',
            option: { keyPath: 'id', autoIncrement: true },
            indexes: [
                { name: 'title', params: 'title', unique: false },
                { name: 'created_at', params: 'created_at', unique: false },
                { name: 'updated_at', params: 'updated_at', unique: false },
                { name: 'favorite', params: 'favorite', unique: false },
                { name: 'category', params: 'category', unique: false },
                // 배열 필드의 원소 하나하나가 인덱스 키가 됩니다. (태그 검색)
                { name: 'methods', params: 'methods', unique: false, multiEntry: true },
                { name: 'ingredient_names', params: 'ingredient_names', unique: false, multiEntry: true },
            ],
            scheme: {
                title: '',
                category: '음식',       // 음식 | 빵/디저트 (recipe.js의 CATEGORIES)
                summary: '',
                servings: '',
                cook_time: '',          // 분
                level: '',              // 쉬움 | 보통 | 어려움
                methods: [],            // 조리방법 태그
                ingredients: [],        // [{ name, amount, optional }] optional: 선택 재료
                ingredient_names: [],   // ingredients의 name만 (인덱스용, 선택 재료 포함)
                steps: [],              // [string]
                tips: '',
                photo: null,            // dataURL
                favorite: 0,            // 0 | 1 (boolean은 인덱스 키가 될 수 없음)
                created_at: 0,
                updated_at: 0,
            }
        },
        {
            name: 'shopping',
            option: { keyPath: 'id', autoIncrement: true },
            indexes: [
                { name: 'created_at', params: 'created_at', unique: false },
                { name: 'checked', params: 'checked', unique: false },
            ],
            scheme: {
                text: '',
                checked: 0,     // 0 | 1
                created_at: 0,
                checked_at: 0,
            }
        },
    ]

    openDatabase() {
        return new Promise((res, rej) => {
            const req = indexedDB.open(this.DATABASE_NAME, this.DATABASE_VERSION)

            req.onupgradeneeded = (e) => {
                this.db = e.target.result
                const transaction = e.target.transaction
                this.TABLE_LIST.forEach((table) => {
                    const store = this.db.objectStoreNames.contains(table.name)
                        ? transaction.objectStore(table.name)
                        : this.db.createObjectStore(table.name, table.option)
                    table.indexes.forEach((index) => {
                        if (!store.indexNames.contains(index.name)) {
                            store.createIndex(index.name, index.params, { unique: index.unique, multiEntry: !!index.multiEntry })
                        }
                    })
                })
            }
            req.onsuccess = (e) => {
                this.db = e.target.result
                // 다른 탭에서 새 버전으로 업그레이드하려 하면 이 연결을 닫고 새로고침합니다.
                this.db.onversionchange = () => {
                    this.db.close()
                    location.reload()
                }
                res(this.db)
            }
            req.onblocked = () => {
                console.log('indexedDB upgrade blocked: 다른 탭에 열린 레시피북이 있어요.')
            }
            req.onerror = (e) => rej(e)
        })
    }

    newRecord(table_name) {
        const table = this.TABLE_LIST.find(t => t.name === table_name)
        return structuredClone(table.scheme)
    }

    requestHandler(req) {
        return new Promise((res, rej) => {
            req.onsuccess = (e) => res(e.target.result)
            req.onerror = (e) => rej(e.target.error)
        })
    }

    store(table_name, mode = 'readonly') {
        return this.db.transaction([table_name], mode).objectStore(table_name)
    }

    doInsert(table_name, value) {
        const record = { ...value }
        delete record.id // autoIncrement 키를 받도록
        return this.requestHandler(this.store(table_name, 'readwrite').add(record))
    }

    doUpdate(table_name, id, value) {
        return this.requestHandler(this.store(table_name, 'readwrite').put({ ...value, id }))
    }

    async doUpdatePartial(table_name, id, value) {
        const record = await this.doSelectOne(table_name, id)
        if (!record) return null
        return this.doUpdate(table_name, id, { ...record, ...value })
    }

    doDelete(table_name, id) {
        return this.requestHandler(this.store(table_name, 'readwrite').delete(id))
    }

    doSelectOne(table_name, id) {
        return this.requestHandler(this.store(table_name).get(id))
    }

    doSelectAll(table_name) {
        return this.requestHandler(this.store(table_name).getAll())
    }

    // 태그 하나로 조회 (multiEntry 인덱스)
    doSelectByIndex(table_name, index_name, value) {
        return this.requestHandler(this.store(table_name).index(index_name).getAll(value))
    }

    // 인덱스의 고유 키 목록 = 지금까지 쓴 태그 목록
    doSelectIndexKeys(table_name, index_name) {
        return new Promise((res, rej) => {
            const keys = []
            const req = this.store(table_name).index(index_name).openKeyCursor(null, 'nextunique')
            req.onsuccess = (e) => {
                const cursor = e.target.result
                if (cursor) {
                    keys.push(cursor.key)
                    cursor.continue()
                } else {
                    res(keys)
                }
            }
            req.onerror = (e) => rej(e.target.error)
        })
    }

    doCountTotal(table_name) {
        return this.requestHandler(this.store(table_name).count())
    }

    doTruncate(table_name) {
        return this.requestHandler(this.store(table_name, 'readwrite').clear())
    }
}

const idb = new IndexedDBClient()
