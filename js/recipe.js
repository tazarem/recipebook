/* 테마 - 파티노트 팔레트를 그대로 가져왔습니다 */
const THEMES = {
    partynote: {
        vars: { '--bg': '#FFCCBC', '--surface': '#FFF4EF', '--text': '#2B1D1A', '--sub': '#7A5A52', '--accent': '#FF8A80', '--accent-text': '#2B1D1A', '--line': '#0000001f', '--overlay': '#00000026' },
        card_pack: ['#FFE0B2', '#FFECB3', '#FFF9C4', '#F0F4C3', '#DCEDC8', '#C8E6C9', '#B2DFDB', '#B2EBF2', '#B3E5FC', '#BBDEFB', '#C5CAE9', '#D1C4E9', '#E1BEE7', '#F8BBD0', '#FFCDD2'],
        meta_color: '#FFCCBC',
    },
    marine: {
        vars: { '--bg': '#E1F5FE', '--surface': '#F5FCFF', '--text': '#141D47', '--sub': '#4A5A80', '--accent': '#0288D1', '--accent-text': '#FFFFFF', '--line': '#141d4721', '--overlay': '#141d4722' },
        card_pack: ['#B3E5FC', '#81D4FA', '#E0F2F1', '#B2DFDB', '#80CBC4', '#E0F7FA', '#B2EBF2', '#80DEEA', '#E8F5E9', '#C8E6C9', '#A5D6A7', '#DCEDC8', '#C5CAE9', '#BBDEFB'],
        meta_color: '#E1F5FE',
    },
    cryptic: {
        vars: { '--bg': '#0D1117', '--surface': '#161B22', '--text': '#E6EDF3', '--sub': '#8B949E', '--accent': '#00D9FF', '--accent-text': '#0D1117', '--line': '#ffffff1f', '--overlay': '#00000066' },
        card_pack: ['#1E1E2E', '#2D2D3A', '#1A1A2E', '#16213E', '#0F3460', '#1B262C', '#0D1B2A', '#1B1B2F', '#162447', '#1F4068', '#232931', '#2C3333', '#27374D', '#1F2833', '#252A34'],
        meta_color: '#0D1117',
    },
}

// 요리 분류. 항목을 늘리려면 여기에만 추가하면 됩니다.
const CATEGORIES = [
    { value: '음식', icon: 'fas fa-utensils' },
    { value: '빵/디저트', icon: 'fas fa-cookie-bite' },
]
const DEFAULT_CATEGORY = CATEGORIES[0].value
const categoryIcon = (value) => (CATEGORIES.find(c => c.value === value) || CATEGORIES[0]).icon

const DEFAULT_METHODS = ['굽기', '볶기', '끓이기', '찌기', '튀기기', '삶기', '조림', '무침', '데치기', '오븐', '에어프라이어', '전자레인지', '비조리', '반죽', '발효', '굳히기']
const DEFAULT_INGREDIENTS = ['양파', '대파', '마늘', '달걀', '돼지고기', '소고기', '닭고기', '두부', '감자', '당근', '애호박', '버섯', '김치', '간장', '고추장', '된장', '설탕', '참기름', '밀가루', '버터', '우유', '생크림', '이스트']
const LEVELS = ['쉬움', '보통', '어려움']

/* 환경설정 - 파티노트 note_config 처럼 localStorage 사용 */
const recipe_config = (() => {
    const KEY = 'rcbk_config'
    const _default = { app_theme: 'partynote', card_layout: 'box', sort: 'updated', category: 'all' }
    let now = { ..._default }
    try { now = { ..._default, ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch (e) { }
    return {
        get: (key) => now[key],
        set: (key, value) => {
            now[key] = value
            try { localStorage.setItem(KEY, JSON.stringify(now)) } catch (e) { }
        },
    }
})()

class RecipeBook {
    recipes = []
    filter = {
        q: '',
        methods: new Set(),
        ingredients: new Set(),
        ingredient_mode: 'all', // all: 모두 포함 | any: 하나라도 포함
        favorite: false,
        category: recipe_config.get('category'), // all | CATEGORIES의 value
    }

    async init() {
        await idb.openDatabase()
        this.applyTheme(recipe_config.get('app_theme'))
        this.applyLayout(recipe_config.get('card_layout'))
        $('#sort-select').value = recipe_config.get('sort')
        await this.migrateRecords()
        await this.reload()
    }

    // 재료 하나를 정리합니다. 이름/양에 붙은 "(선택)" 표시는 떼고 optional로 옮깁니다.
    normalizeIngredient(i) {
        if (typeof i === 'string') i = { name: i }
        const name = IngredientInput.stripOptional(String(i.name || ''))
        const amount = IngredientInput.stripOptional(String(i.amount || ''))
        return { name: name.text, amount: amount.text, optional: !!i.optional || name.optional || amount.optional }
    }

    normalizeCategory(value) {
        return CATEGORIES.some(c => c.value === value) ? value : DEFAULT_CATEGORY
    }

    // 이전 버전에서 저장한 레시피를 현재 형식으로 맞춥니다.
    // - v0.1: "옥수수(선택)" 처럼 이름에 적어 둔 재료 → 선택 재료
    // - v0.3 이하: 분류가 없으면 '음식'
    async migrateRecords() {
        const recipes = await idb.doSelectAll('recipe')
        for (const r of recipes) {
            const fix_ingredients = (r.ingredients || []).some(i => i.optional === undefined || /[(\[]\s*선택\s*[)\]]/.test(i.name + i.amount))
            const fix_category = r.category !== this.normalizeCategory(r.category)
            if (!fix_ingredients && !fix_category) continue
            const ingredients = r.ingredients.map(i => this.normalizeIngredient(i)).filter(i => i.name)
            await idb.doUpdate('recipe', r.id, {
                ...r,
                category: this.normalizeCategory(r.category),
                ingredients,
                ingredient_names: [...new Set(ingredients.map(i => i.name))],
            })
        }
    }

    async reload() {
        this.recipes = await idb.doSelectAll('recipe')
        this.render()
    }

    /* ---------- 테마 / 레이아웃 ---------- */
    applyTheme(name) {
        const theme = THEMES[name] || THEMES.partynote
        Object.entries(theme.vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v))
        $('meta[name="theme-color"]').setAttribute('content', theme.meta_color)
        document.documentElement.dataset.theme = name
        $$('input[name="app_theme"]').forEach(el => el.checked = el.value === name)
        this.theme = theme
    }

    // box: 바둑판 | list: 리스트 | name: 이름만 (그림 없이 요리 이름 한 줄)
    applyLayout(layout) {
        if (!['box', 'list', 'name'].includes(layout)) layout = 'box'
        const container = $('.recipe-container')
        container.classList.remove('box-style', 'list-style', 'name-style')
        container.classList.add(`${layout}-style`)
        $$('input[name="card_layout"]').forEach(el => el.checked = el.value === layout)
    }

    cardColor(id) {
        const pack = this.theme.card_pack
        return pack[(id * 7) % pack.length]
    }

    /* ---------- 분류 ---------- */
    inCategory(r) {
        return this.filter.category === 'all' || r.category === this.filter.category
    }

    setCategory(value) {
        this.filter.category = value
        recipe_config.set('category', value)
        this.render()
    }

    renderCategoryTabs() {
        const count = (value) => value === 'all' ? this.recipes.length : this.recipes.filter(r => r.category === value).length
        const tabs = [{ value: 'all', label: '전체', icon: 'fas fa-book-open' }, ...CATEGORIES.map(c => ({ ...c, label: c.value }))]
        $('.category-tabs').innerHTML = tabs.map(t => {
            const on = this.filter.category === t.value
            return `<button type="button" class="category-tab ${on ? 'on' : ''}" role="tab" aria-selected="${on}" data-category="${esc(t.value)}">
                <i class="${t.icon}"></i> ${esc(t.label)} <span class="count">${count(t.value)}</span></button>`
        }).join('')
    }

    /* ---------- 태그 모음 ---------- */
    // 쓰인 횟수가 많은 순서로 정렬된 태그 목록 (scoped: 지금 고른 분류 안에서만)
    tagCounts(field, scoped = false) {
        const counts = new Map()
        const source = scoped ? this.recipes.filter(r => this.inCategory(r)) : this.recipes
        source.forEach(r => (r[field] || []).forEach(t => counts.set(t, (counts.get(t) || 0) + 1)))
        return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))
    }

    suggestions(field, defaults) {
        return [...new Set([...this.tagCounts(field).map(([t]) => t), ...defaults])]
    }

    /* ---------- 필터 ---------- */
    filtered() {
        const { q, methods, ingredients, ingredient_mode, favorite } = this.filter
        const query = q.trim().toLowerCase()
        let list = this.recipes.filter(r => {
            if (!this.inCategory(r)) return false
            if (favorite && !r.favorite) return false
            if (methods.size && ![...methods].every(m => r.methods.includes(m))) return false
            if (ingredients.size) {
                const has = [...ingredients].map(i => r.ingredient_names.includes(i))
                if (ingredient_mode === 'all' ? !has.every(Boolean) : !has.some(Boolean)) return false
            }
            if (query) {
                const haystack = [r.title, r.category, r.summary, r.tips, ...r.methods, ...r.ingredient_names, ...r.steps].join(' ').toLowerCase()
                if (!haystack.includes(query)) return false
            }
            return true
        })

        const sort = recipe_config.get('sort')
        const sorter = {
            updated: (a, b) => b.updated_at - a.updated_at,
            created: (a, b) => b.created_at - a.created_at,
            title: (a, b) => a.title.localeCompare(b.title, 'ko'),
            time: (a, b) => (Number(a.cook_time) || 9999) - (Number(b.cook_time) || 9999),
        }[sort] || ((a, b) => b.updated_at - a.updated_at)
        list.sort(sorter)

        // "하나라도 포함" 모드에서는 겹치는 재료가 많은 레시피를 위로
        if (ingredients.size && ingredient_mode === 'any') {
            const score = r => [...ingredients].filter(i => r.ingredient_names.includes(i)).length
            list.sort((a, b) => score(b) - score(a))
        }
        return list
    }

    hasActiveFilter() {
        const f = this.filter
        return !!(f.q.trim() || f.methods.size || f.ingredients.size || f.favorite)
    }

    toggleFilterTag(kind, value) {
        const set = this.filter[kind]
        set.has(value) ? set.delete(value) : set.add(value)
        this.render()
    }

    resetFilter() {
        this.filter.q = ''
        this.filter.methods.clear()
        this.filter.ingredients.clear()
        this.filter.favorite = false
        $('#recipe-searcher').value = ''
        $('.search-deleter').classList.add('hide')
        this.render()
    }

    /* ---------- 목록 렌더링 ---------- */
    render() {
        this.renderCategoryTabs()
        this.renderFilterBar()
        this.renderCards()
    }

    renderFilterBar() {
        const f = this.filter
        const chip = (kind, [tag, count]) => {
            const on = f[kind].has(tag)
            return `<button type="button" class="chip ${on ? 'on' : ''}" data-filter-kind="${kind}" data-filter-tag="${esc(tag)}" aria-pressed="${on}">${esc(tag)}<span class="count">${count}</span></button>`
        }
        // 선택된 태그가 목록에서 사라지지 않도록 합쳐서 보여줍니다.
        const withSelected = (kind, field) => {
            const counts = this.tagCounts(field, true)
            f[kind].forEach(t => { if (!counts.some(([c]) => c === t)) counts.unshift([t, 0]) })
            return counts
        }

        const methods = withSelected('methods', 'methods')
        const ingredients = withSelected('ingredients', 'ingredient_names')

        $('.filter-row.methods .chips').innerHTML = methods.length
            ? methods.map(c => chip('methods', c)).join('')
            : `<span class="empty-hint">레시피를 저장하면 조리방법 태그가 생겨요</span>`
        $('.filter-row.ingredients .chips').innerHTML = ingredients.length
            ? ingredients.map(c => chip('ingredients', c)).join('')
            : `<span class="empty-hint">레시피를 저장하면 재료 태그가 생겨요</span>`

        const mode_btn = $('.ingredient-mode')
        mode_btn.textContent = f.ingredient_mode === 'all' ? '모두 포함' : '하나라도'
        mode_btn.classList.toggle('hide', f.ingredients.size < 2)

        $('.favorite-filter').classList.toggle('on', f.favorite)
        $('.favorite-filter').setAttribute('aria-pressed', f.favorite)
        $('.filter-reset').classList.toggle('hide', !this.hasActiveFilter())
        $('.filter-toggle .badge').textContent = f.methods.size + f.ingredients.size || ''
    }

    renderCards() {
        const list = this.filtered()
        const container = $('.recipe-container')
        const scope_total = this.recipes.filter(r => this.inCategory(r)).length
        $('.lottery-fab').classList.toggle('hide', !list.length)
        $('.lottery-fab .badge').textContent = list.length
        $('.result-count').textContent = this.hasActiveFilter()
            ? `${list.length} / ${scope_total}개`
            : `레시피 ${scope_total}개`

        if (!this.recipes.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-utensils"></i>
                    <p>아직 저장한 레시피가 없어요.</p>
                    <button type="button" class="btn primary" data-action="write"><i class="fas fa-plus"></i> 첫 레시피 쓰기</button>
                </div>`
            return
        }
        if (!scope_total) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="${categoryIcon(this.filter.category)}"></i>
                    <p>${esc(this.filter.category)} 레시피가 아직 없어요.</p>
                    <button type="button" class="btn primary" data-action="write"><i class="fas fa-plus"></i> ${esc(this.filter.category)} 레시피 쓰기</button>
                </div>`
            return
        }
        if (!list.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <p>조건에 맞는 레시피가 없어요.</p>
                    <button type="button" class="btn ghost" data-action="reset-filter">필터 초기화</button>
                </div>`
            return
        }

        container.innerHTML = list.map(r => {
            const ordered = [...r.ingredients.filter(i => !i.optional), ...r.ingredients.filter(i => i.optional)]
            const ing_preview = ordered.slice(0, 6).map(i => {
                const cls = [this.filter.ingredients.has(i.name) ? 'hit' : '', i.optional ? 'opt' : ''].join(' ').trim()
                return `<span class="${cls}">${esc(i.name)}</span>`
            }).join(' · ')
            const more = ordered.length > 6 ? ` 외 ${ordered.length - 6}` : ''
            return `
            <article class="recipe-card" data-id="${r.id}" tabindex="0" style="--card:${this.cardColor(r.id)}">
                <div class="card-thumb">
                    ${safePhoto(r.photo) ? `<img src="${esc(safePhoto(r.photo))}" alt="" loading="lazy">` : `<span class="thumb-letter">${esc([...r.title][0] || '?')}</span>`}
                    ${r.favorite ? `<i class="fas fa-star card-fav" aria-label="즐겨찾기"></i>` : ''}
                    ${this.filter.category === 'all' ? `<span class="card-category"><i class="${categoryIcon(r.category)}"></i> ${esc(r.category)}</span>` : ''}
                </div>
                <div class="card-body">
                    <h3 class="card-title">${r.favorite ? `<i class="fas fa-star title-fav" aria-hidden="true"></i>` : ''}${esc(r.title)}</h3>
                    <div class="card-meta">
                        ${r.cook_time ? `<span><i class="far fa-clock"></i> ${esc(r.cook_time)}분</span>` : ''}
                        ${r.servings ? `<span><i class="fas fa-user-friends"></i> ${esc(r.servings)}인분</span>` : ''}
                        ${r.level ? `<span>${esc(r.level)}</span>` : ''}
                    </div>
                    <div class="card-methods">${r.methods.map(m => `<span class="chip mini ${this.filter.methods.has(m) ? 'on' : ''}">${esc(m)}</span>`).join('')}</div>
                    <div class="card-ingredients">${ing_preview}${more}</div>
                </div>
            </article>`
        }).join('')
    }

    /* ---------- 상세 ---------- */
    async renderDetail(id) {
        const r = await idb.doSelectOne('recipe', id)
        if (!r) return ui.toast('레시피를 찾을 수 없어요')

        const actions = `
            <button type="button" class="icon-btn" data-action="favorite" data-id="${r.id}" aria-label="즐겨찾기">
                <i class="${r.favorite ? 'fas' : 'far'} fa-star"></i></button>
            <button type="button" class="icon-btn" data-action="edit" data-id="${r.id}" aria-label="편집"><i class="fas fa-pen"></i></button>
            <button type="button" class="icon-btn" data-action="delete" data-id="${r.id}" aria-label="삭제"><i class="far fa-trash-alt"></i></button>`

        ui.openPopup({ title: esc(r.title), actions, content: this.detailContent(r) })
    }

    // 레시피 상세 본문 (상세 팝업, 식단 일기의 '레시피 보기' 탭에서 같이 씀)
    detailContent(r) {
        const required = r.ingredients.filter(i => !i.optional)
        const optional = r.ingredients.filter(i => i.optional)
        const ingredientList = (list) => `
            <ul class="check-list ingredients">
                ${list.map(i => `
                <li><label>
                    <input type="checkbox">
                    <span class="ing-name">${esc(i.name)}</span>
                    <span class="ing-amount">${esc(i.amount)}</span>
                </label></li>`).join('')}
            </ul>`

        const content = `
            <div class="detail">
                ${safePhoto(r.photo) ? `<img class="detail-photo" src="${esc(safePhoto(r.photo))}" alt="">` : ''}
                ${r.summary ? `<p class="detail-summary">${esc(r.summary)}</p>` : ''}
                <div class="detail-meta">
                    <span><i class="${categoryIcon(r.category)}"></i> ${esc(r.category)}</span>
                    ${r.cook_time ? `<span><i class="far fa-clock"></i> ${esc(r.cook_time)}분</span>` : ''}
                    ${r.servings ? `<span><i class="fas fa-user-friends"></i> ${esc(r.servings)}인분</span>` : ''}
                    ${r.level ? `<span><i class="fas fa-signal"></i> ${esc(r.level)}</span>` : ''}
                </div>

                ${r.methods.length ? `
                <section>
                    <h4><i class="fas fa-fire"></i> 조리방법</h4>
                    <div class="chips wrap">${r.methods.map(m => `<button type="button" class="chip" data-action="goto-tag" data-kind="methods" data-tag="${esc(m)}">${esc(m)}</button>`).join('')}</div>
                </section>` : ''}

                ${required.length ? `
                <section>
                    <h4><i class="fas fa-carrot"></i> 재료 <small>${required.length}가지 · 눌러서 체크</small></h4>
                    ${ingredientList(required)}
                </section>` : ''}

                ${optional.length ? `
                <section>
                    <h4><i class="fas fa-seedling"></i> 선택 재료 <small>없어도 괜찮아요</small></h4>
                    ${ingredientList(optional)}
                </section>` : ''}

                ${r.steps.length ? `
                <section>
                    <h4><i class="fas fa-list-ol"></i> 만드는 방법</h4>
                    <ol class="step-list">
                        ${r.steps.map((s, i) => `
                        <li><label>
                            <input type="checkbox">
                            <span class="step-no">${i + 1}</span>
                            <span class="step-text">${esc(s)}</span>
                        </label></li>`).join('')}
                    </ol>
                </section>` : ''}

                ${r.tips ? `
                <section>
                    <h4><i class="far fa-lightbulb"></i> 팁 · 메모</h4>
                    <p class="detail-tips">${linkify(r.tips)}</p>
                </section>` : ''}

                <div class="detail-date">작성 ${this.formatDate(r.created_at)}${r.updated_at !== r.created_at ? ` · 수정 ${this.formatDate(r.updated_at)}` : ''}</div>
            </div>`

        return content
    }

    formatDate(ts) {
        const d = new Date(ts)
        const p = n => String(n).padStart(2, '0')
        return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`
    }

    /* ---------- 작성 / 편집 ---------- */
    async renderEditor(id = null) {
        const r = id ? await idb.doSelectOne('recipe', id) : idb.newRecord('recipe')
        if (!id && this.filter.category !== 'all') r.category = this.filter.category
        r.photo = safePhoto(r.photo)
        this.editing = { id, photo: r.photo }

        const content = `
            <form class="editor" autocomplete="off">
                <label class="photo-picker ${r.photo ? 'has-photo' : ''}">
                    <input type="file" accept="image/*" class="photo-input" hidden>
                    <img class="photo-preview" src="${esc(r.photo || '')}" alt="">
                    <span class="photo-empty"><i class="fas fa-camera"></i> 사진 추가 (선택)</span>
                    <button type="button" class="icon-btn solid photo-remove" aria-label="사진 삭제"><i class="fas fa-times"></i></button>
                </label>

                <input type="text" name="title" class="title-input" placeholder="요리 이름" value="${esc(r.title)}" required maxlength="80">
                <input type="text" name="summary" placeholder="한 줄 소개 (선택)" value="${esc(r.summary)}" maxlength="200">

                <div class="segmented" role="radiogroup" aria-label="분류">
                    ${CATEGORIES.map(c => `
                    <label>
                        <input type="radio" name="category" value="${esc(c.value)}" ${r.category === c.value ? 'checked' : ''}>
                        <span><i class="${c.icon}"></i> ${esc(c.value)}</span>
                    </label>`).join('')}
                </div>

                <div class="field-grid">
                    <label>
                        <span class="field-label">인분</span>
                        <input type="number" name="servings" inputmode="numeric" min="1" max="99" value="${esc(r.servings)}" placeholder="2">
                    </label>
                    <label>
                        <span class="field-label">조리시간(분)</span>
                        <input type="number" name="cook_time" inputmode="numeric" min="1" max="9999" value="${esc(r.cook_time)}" placeholder="30">
                    </label>
                    <label>
                        <span class="field-label">난이도</span>
                        <select name="level">
                            <option value="">-</option>
                            ${LEVELS.map(l => `<option ${r.level === l ? 'selected' : ''}>${l}</option>`).join('')}
                        </select>
                    </label>
                </div>

                <div class="field">
                    <span class="field-label"><i class="fas fa-fire"></i> 조리방법</span>
                    <div class="methods-input"></div>
                </div>

                <div class="field">
                    <span class="field-label"><i class="fas fa-carrot"></i> 재료</span>
                    <div class="ingredients-input"></div>
                </div>

                <div class="field">
                    <span class="field-label"><i class="fas fa-list-ol"></i> 만드는 방법</span>
                    <ol class="step-editor"></ol>
                    <button type="button" class="btn ghost add-step"><i class="fas fa-plus"></i> 단계 추가</button>
                </div>

                <div class="field">
                    <span class="field-label"><i class="far fa-lightbulb"></i> 팁 · 메모</span>
                    <textarea name="tips" rows="3" placeholder="불 조절, 대체 재료 등">${esc(r.tips)}</textarea>
                </div>

                <div class="editor-btns">
                    <button type="button" class="btn ghost" data-action="editor-cancel">취소</button>
                    <button type="submit" class="btn primary"><i class="fas fa-check"></i> 저장</button>
                </div>
            </form>`

        ui.openPopup({
            title: id ? '레시피 편집' : '새 레시피',
            content,
            before_close: () => this.confirmLeaveEditor(),
        })

        const form = $('.popup-content .editor')
        this.method_input = new TagInput($('.methods-input', form), {
            values: r.methods,
            suggestions: this.suggestions('methods', DEFAULT_METHODS),
            placeholder: '예: 볶기 (Enter)',
        })
        this.ingredient_input = new IngredientInput($('.ingredients-input', form), {
            values: r.ingredients,
            suggestions: this.suggestions('ingredient_names', DEFAULT_INGREDIENTS),
        })
        const steps = r.steps.length ? r.steps : ['']
        steps.forEach(s => this.addStepRow(s))
        $$('.editor textarea', form).forEach(autoGrow)
        this.initial_snapshot = JSON.stringify(this.collectForm())
        if (!id) $('.title-input', form).focus()
    }

    addStepRow(text = '', after = null) {
        const li = document.createElement('li')
        li.innerHTML = `
            <span class="step-no"></span>
            <textarea rows="2" placeholder="예: 양파를 채 썰어 중불에 볶는다"></textarea>
            <div class="step-tools">
                <button type="button" class="icon-btn" data-step="up" aria-label="위로"><i class="fas fa-chevron-up"></i></button>
                <button type="button" class="icon-btn" data-step="down" aria-label="아래로"><i class="fas fa-chevron-down"></i></button>
                <button type="button" class="icon-btn" data-step="del" aria-label="단계 삭제"><i class="fas fa-times"></i></button>
            </div>`
        $('textarea', li).value = text
        const list = $('.step-editor')
        after ? after.after(li) : list.appendChild(li)
        this.renumberSteps()
        autoGrow($('textarea', li))
        return li
    }

    renumberSteps() {
        $$('.step-editor > li').forEach((li, i) => $('.step-no', li).textContent = i + 1)
    }

    collectForm() {
        const form = $('.popup-content .editor')
        if (!form) return null
        const data = Object.fromEntries(new FormData(form))
        const ingredients = this.ingredient_input.getValues()
        return {
            title: (data.title || '').trim(),
            summary: (data.summary || '').trim(),
            servings: data.servings || '',
            cook_time: data.cook_time || '',
            level: data.level || '',
            category: this.normalizeCategory(data.category),
            methods: this.method_input.getValues(),
            ingredients,
            ingredient_names: [...new Set(ingredients.map(i => i.name))],
            steps: $$('.step-editor textarea').map(t => t.value.trim()).filter(Boolean),
            tips: (data.tips || '').trim(),
            photo: this.editing.photo || null,
        }
    }

    async confirmLeaveEditor() {
        const now = this.collectForm()
        if (!now || JSON.stringify(now) === this.initial_snapshot) return true
        return ui.confirm('작성 중인 내용이 저장되지 않아요. 나갈까요?', { ok: '나가기', danger: true })
    }

    async saveRecipe() {
        const data = this.collectForm()
        if (!data.title) {
            ui.toast('요리 이름을 입력해 주세요')
            $('.popup-content .title-input').focus()
            return
        }
        const now = Date.now()
        let id = this.editing.id
        if (id) {
            const prev = await idb.doSelectOne('recipe', id)
            await idb.doUpdate('recipe', id, { ...prev, ...data, updated_at: now })
        } else {
            id = await idb.doInsert('recipe', { ...idb.newRecord('recipe'), ...data, created_at: now, updated_at: now })
        }
        this.initial_snapshot = JSON.stringify(data)
        await this.reload()
        ui.toast('저장했어요')
        this.renderDetail(id) // 팝업은 그대로 두고 상세 화면으로 교체
    }

    // 사진은 긴 변 1000px JPEG로 줄여서 dataURL로 저장합니다. (백업 JSON에 그대로 들어가도록)
    resizePhoto(file, max = 1000) {
        return new Promise((res, rej) => {
            const img = new Image()
            const url = URL.createObjectURL(file)
            img.onload = () => {
                const scale = Math.min(1, max / Math.max(img.width, img.height))
                const canvas = document.createElement('canvas')
                canvas.width = Math.round(img.width * scale)
                canvas.height = Math.round(img.height * scale)
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
                URL.revokeObjectURL(url)
                res(canvas.toDataURL('image/jpeg', 0.82))
            }
            img.onerror = (e) => {
                URL.revokeObjectURL(url)
                rej(e)
            }
            img.src = url
        })
    }

    async setPhoto(file) {
        try {
            this.editing.photo = file ? await this.resizePhoto(file) : null
        } catch (e) {
            return ui.toast('사진을 불러오지 못했어요')
        }
        const picker = $('.popup-content .photo-picker')
        picker.classList.toggle('has-photo', !!this.editing.photo)
        $('.photo-preview', picker).src = this.editing.photo || ''
    }

    /* ---------- 메뉴 추첨 ---------- */
    // 지금 목록(분류 탭 + 태그 + 검색 + 즐겨찾기)에서 하나를 뽑습니다. 필터가 없으면 전체.
    drawLottery() {
        const pool = this.filtered()
        if (!pool.length) return ui.toast('추첨할 레시피가 없어요')

        // 후보가 둘 이상이면 방금 나온 메뉴는 연달아 나오지 않게
        const candidates = pool.length > 1 ? pool.filter(r => r.id !== this.last_winner_id) : pool
        const winner = candidates[Math.floor(Math.random() * candidates.length)]
        this.last_winner_id = winner.id
        const token = this.lottery_token = (this.lottery_token || 0) + 1

        ui.openPopup({
            variant: 'lottery',
            title: `<span class="emoji" aria-hidden="true">🎉</span> <span class="lottery-title-text"></span>`,
            content: `
                <div class="lottery">
                    <div class="lottery-reel" aria-hidden="true"><span></span></div>
                    <div class="lottery-result hide" aria-live="polite"></div>
                </div>`,
        })

        if (pool.length === 1) return this.revealWinner(winner, token)
        this.spinReel(pool, winner, token)
    }

    // 요리 이름이 빠르게 돌다가 점점 느려지고, 마지막에 당첨작에서 멈추는 룰렛
    spinReel(pool, winner, token) {
        const reel = $('.lottery-reel span')

        // 후보를 섞고 당첨작을 맨 뒤로 → 이 순서를 반복해서 돌리면 마지막 칸이 당첨작
        const order = [...pool].sort(() => Math.random() - .5).filter(r => r.id !== winner.id)
        order.push(winner)
        const delays = []
        for (let d = 45; d <= 260; d *= 1.13) delays.push(d)
        const n = delays.length
        const titleAt = (i) => order[((order.length - 1 - (n - 1 - i)) % order.length + order.length) % order.length].title

        let i = 0
        const step = () => {
            if (token !== this.lottery_token || !$('.lottery-reel')) return // 닫혔거나 다시 뽑음
            reel.textContent = titleAt(i)
            reel.classList.remove('tick')
            void reel.offsetWidth // 애니메이션 재시작
            reel.classList.add('tick')
            if (i === n - 1) {
                reel.classList.add('landed') // 당첨작에서 멈춤
                return setTimeout(() => this.revealWinner(winner, token), 450)
            }
            setTimeout(step, delays[i++])
        }
        step()
    }

    revealWinner(r, token) {
        if (token !== this.lottery_token || !$('.lottery')) return
        const required = r.ingredients.filter(i => !i.optional).map(i => i.name)
        const photo = safePhoto(r.photo)
        $('.lottery-reel').classList.add('hide')
        const result = $('.lottery-result')
        result.innerHTML = `
            <div class="lottery-card" style="--card:${this.cardColor(r.id)}">
                <div class="lottery-thumb">
                    ${photo ? `<img src="${esc(photo)}" alt="">` : `<span class="thumb-letter">${esc([...r.title][0] || '?')}</span>`}
                </div>
                <div class="lottery-body">
                    <div class="lottery-category"><i class="${categoryIcon(r.category)}"></i> ${esc(r.category)}</div>
                    <h3 class="lottery-title">${esc(r.title)}</h3>
                    <div class="card-meta">
                        ${r.cook_time ? `<span><i class="far fa-clock"></i> ${esc(r.cook_time)}분</span>` : ''}
                        ${r.servings ? `<span><i class="fas fa-user-friends"></i> ${esc(r.servings)}인분</span>` : ''}
                        ${r.level ? `<span>${esc(r.level)}</span>` : ''}
                    </div>
                    ${r.methods.length ? `<div class="card-methods">${r.methods.map(m => `<span class="chip mini">${esc(m)}</span>`).join('')}</div>` : ''}
                    ${required.length ? `<div class="lottery-ingredients">${required.map(esc).join(' · ')}</div>` : ''}
                </div>
            </div>
            <div class="lottery-btns">
                <button type="button" class="btn ghost" data-action="lottery-again"><i class="fas fa-redo"></i> 다시 뽑기</button>
                <button type="button" class="btn primary" data-action="lottery-open" data-id="${r.id}"><i class="fas fa-book-open"></i> 레시피 보기</button>
            </div>`
        result.classList.remove('hide')
        $('.popup-header .lottery-title-text').textContent = '당첨!'
        this.burstConfetti($('.lottery'))
    }

    // 폭죽 조각을 가운데에서 사방으로 터뜨립니다.
    burstConfetti(stage) {
        const colors = [...this.theme.card_pack.slice(0, 8), this.theme.vars['--accent'], '#FFD54F', '#FF8A80', '#80D8FF']
        const layer = document.createElement('div')
        layer.className = 'confetti-layer'
        for (let i = 0; i < 48; i++) {
            const piece = document.createElement('i')
            const angle = Math.random() * Math.PI * 2
            const dist = 90 + Math.random() * 170
            piece.className = 'confetti'
            piece.style.setProperty('--x', `${Math.cos(angle) * dist}px`)
            piece.style.setProperty('--y', `${Math.sin(angle) * dist - 60}px`)
            piece.style.setProperty('--r', `${Math.random() * 720 - 360}deg`)
            piece.style.setProperty('--d', `${700 + Math.random() * 600}ms`)
            piece.style.background = colors[i % colors.length]
            if (i % 3 === 0) piece.style.borderRadius = '50%'
            layer.appendChild(piece)
        }
        stage.appendChild(layer)
        setTimeout(() => layer.remove(), 1500)
    }

    /* ---------- 즐겨찾기 / 삭제 ---------- */
    async toggleFavorite(id) {
        const r = await idb.doSelectOne('recipe', id)
        await idb.doUpdatePartial('recipe', id, { favorite: r.favorite ? 0 : 1 })
        await this.reload()
        const icon = $(`.popup-header [data-action="favorite"] i`)
        if (icon) icon.className = `${r.favorite ? 'far' : 'fas'} fa-star`
        ui.toast(r.favorite ? '즐겨찾기에서 뺐어요' : '즐겨찾기에 넣었어요')
    }

    async deleteRecipe(id) {
        const r = await idb.doSelectOne('recipe', id)
        const ok = await ui.confirm(`'${r.title}' 레시피를 삭제할까요?\n삭제하면 되돌릴 수 없어요.`, { ok: '삭제', danger: true })
        if (!ok) return
        await idb.doDelete('recipe', id)
        await this.reload()
        ui.closePopup()
        ui.toast('삭제했어요')
    }

    /* ---------- 백업 ---------- */
    async exportBackup() {
        const recipes = await idb.doSelectAll('recipe')
        const shopping = await idb.doSelectAll('shopping')
        const meals = await idb.doSelectAll('meal')
        const payload = {
            app: APP_CONFIG.app_alias,
            version: APP_CONFIG.app_version,
            exported_at: new Date().toISOString(),
            recipes,
            shopping,
            meals,
        }
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
        const a = document.createElement('a')
        const d = new Date()
        a.href = URL.createObjectURL(blob)
        a.download = `recipebook-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 1000)
        ui.toast(`레시피 ${recipes.length}개를 내보냈어요`)
    }

    async importBackup(file) {
        let payload
        try {
            payload = JSON.parse(await file.text())
        } catch (e) {
            return ui.toast('백업 파일을 읽지 못했어요')
        }
        const list = Array.isArray(payload) ? payload : payload.recipes
        if (!Array.isArray(list)) return ui.toast('레시피북 백업 파일이 아니에요')

        const mode = await ui.choose(
            `백업에 레시피 ${list.length}개가 있어요. (지금 ${this.recipes.length}개)\n\n합치기: 지금 레시피는 그대로 두고 백업 레시피를 더해요.\n모두 바꾸기: 지금 데이터를 지우고 백업으로 바꿔요.`,
            [
                { value: 'replace', label: '모두 바꾸기', style: 'danger-ghost' },
                { value: 'merge', label: '합치기', style: 'primary' },
            ])
        if (!mode) return
        const replace = mode === 'replace'
        if (replace) {
            const ok = await ui.confirm(
                `지금 있는 레시피 ${this.recipes.length}개가 모두 지워지고 백업 내용으로 바뀌어요.\n(백업에 장바구니·식단이 들어 있으면 그것도 바뀌어요)\n계속할까요?`,
                { ok: '모두 바꾸기', danger: true })
            if (!ok) return
            await idb.doTruncate('recipe')
        }

        // 합치기인데 이름이 겹치는 레시피가 있으면: 같은 건 합칠지, 번호 붙여 둘 다 둘지
        let keep_both = false
        if (!replace) {
            const titles = new Set(this.recipes.map(r => r.title))
            const clashes = [...new Set(list.filter(i => i && titles.has(String(i.title))).map(i => String(i.title)))]
            if (clashes.length) {
                const preview = clashes.slice(0, 3).join(', ') + (clashes.length > 3 ? ` 외 ${clashes.length - 3}개` : '')
                const how = await ui.choose(
                    `레시피 이름이 같을 경우 어떻게 할까요?\n(${preview})`,
                    [
                        { value: 'overwrite', label: '더 최신 버전으로 덮어쓰기', style: 'primary' },
                        { value: 'rename', label: '이름 바꿔서 저장', style: 'ghost' },
                    ],
                    { stack: true })
                if (!how) return
                keep_both = how === 'rename'
            }
        }

        const result = await this.importRecipes(list, { keep_both })
        await this.reload()
        const shop_count = await this.importShopping(payload.shopping, replace)
        const meal_count = await this.importMeals(payload.meals, replace)

        const parts = [
            `새로 ${result.added}개`,
            result.updated && `갱신 ${result.updated}개`,
            result.skipped && `이미 있음 ${result.skipped}개`,
        ].filter(Boolean)
        const extras = [shop_count && `장바구니 ${shop_count}개`, meal_count && `식단 ${meal_count}개`].filter(Boolean)
        ui.toast(`레시피 ${parts.join(' · ')}${extras.length ? ` / ${extras.join(', ')}` : ''}`)
    }

    // 백업 레시피를 현재 형식으로 정리 (id는 버리고, 사진·분류·재료는 검증)
    cleanImportedRecipe(item) {
        const ingredients = (item.ingredients || [])
            .map(i => this.normalizeIngredient(i))
            .filter(i => i.name)
        const { id, ...rest } = item
        return {
            ...idb.newRecord('recipe'),
            ...rest,
            title: String(item.title),
            methods: (item.methods || []).map(String),
            ingredients,
            ingredient_names: [...new Set(ingredients.map(i => i.name))],
            steps: (item.steps || []).map(String),
            favorite: item.favorite ? 1 : 0,
            category: this.normalizeCategory(item.category),
            photo: safePhoto(item.photo),
            created_at: Number(item.created_at) || Date.now(),
            updated_at: Number(item.updated_at) || Date.now(),
        }
    }

    // 합치기
    // - 이름이 안 겹치면 추가
    // - keep_both(이름 바꿔서 저장): 겹치면 '이름 (2)'로 추가
    // - 아니면(더 최신 버전으로 덮어쓰기): 같은 이름 중 더 최근에 고친 쪽만 남김
    //   (수정 시각이 없는 옛 백업은 어느 쪽이 최신인지 모르므로 지금 레시피를 남김)
    async importRecipes(list, { keep_both = false } = {}) {
        const existing = await idb.doSelectAll('recipe')
        const taken = new Set(existing.map(r => r.title))
        const result = { added: 0, updated: 0, skipped: 0 }
        for (const item of list) {
            if (!item || !item.title) continue
            const has_updated = Number(item.updated_at) > 0
            const recipe = this.cleanImportedRecipe(item)
            const same = keep_both ? null : existing
                .filter(r => r.title === recipe.title)
                .sort((a, b) => b.updated_at - a.updated_at)[0]
            if (!same) {
                recipe.title = this.uniqueTitle(recipe.title, taken)
                taken.add(recipe.title)
                const id = await idb.doInsert('recipe', recipe)
                existing.push({ ...recipe, id }) // 백업 안에 같은 이름이 또 있어도 한 번만
                result.added++
            } else if (has_updated && recipe.updated_at > same.updated_at) {
                const updated = { ...recipe, id: same.id, created_at: same.created_at }
                await idb.doUpdate('recipe', same.id, updated)
                Object.assign(same, updated)
                result.updated++
            } else {
                result.skipped++
            }
        }
        return result
    }

    // '제육볶음'이 있으면 '제육볶음 (2)', 그것도 있으면 '제육볶음 (3)' …
    uniqueTitle(title, taken) {
        if (!taken.has(title)) return title
        let n = 2
        while (taken.has(`${title} (${n})`)) n++
        return `${title} (${n})`
    }

    // 백업의 식단(일기 포함). 레시피 id는 가져오면서 바뀌므로 이름으로 다시 연결합니다.
    // 같은 날·끼니·이름의 식단이 이미 있으면 건너뛰되, 지금 쪽에 일기가 없고 백업에 있으면 일기만 채웁니다.
    async importMeals(list, replace) {
        if (!Array.isArray(list)) return 0
        if (replace) await idb.doTruncate('meal')
        const existing = new Map((await idb.doSelectAll('meal')).map(m => [`${m.date}|${m.slot}|${m.title}`, m]))
        let count = 0
        for (const item of list) {
            const date = String(item?.date ?? '')
            const title = String(item?.title ?? '').trim().slice(0, 60)
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !title) continue
            const slot = MEAL_SLOTS.includes(item.slot) ? item.slot : '점심'
            const diary = {
                rating: normalizeRating(item.rating),
                sticker: safeSticker(item.sticker),
                note: String(item.note ?? '').slice(0, 1000),
                photo: safePhoto(item.photo),
                diary_at: Number(item.diary_at) || 0,
            }
            const key = `${date}|${slot}|${title}`
            const same = existing.get(key)
            if (same) {
                if (!hasDiary(same) && hasDiary(diary)) {
                    await idb.doUpdatePartial('meal', same.id, diary)
                    Object.assign(same, diary)
                    count++
                }
                continue
            }
            const recipe = this.recipes.find(r => r.title === title)
            const meal = {
                ...idb.newRecord('meal'),
                date,
                slot,
                title,
                recipe_id: recipe ? recipe.id : null,
                created_at: Number(item.created_at) || Date.now(),
                ...diary,
            }
            const id = await idb.doInsert('meal', meal)
            existing.set(key, { ...meal, id })
            count++
        }
        if (document.body.dataset.view === 'meals') await meal_plan.render()
        return count
    }

    // 백업의 장바구니 목록. 없거나 형식이 다르면 건너뜁니다.
    async importShopping(list, replace) {
        if (!Array.isArray(list)) return 0
        if (replace) await idb.doTruncate('shopping')
        const existing = new Set((await idb.doSelectAll('shopping')).map(i => i.text))
        let count = 0
        for (const item of list) {
            const text = String(item?.text ?? '').trim().slice(0, 100)
            if (!text || existing.has(text)) continue
            existing.add(text)
            await idb.doInsert('shopping', {
                ...idb.newRecord('shopping'),
                text,
                checked: item.checked ? 1 : 0,
                created_at: Number(item.created_at) || Date.now(),
                checked_at: Number(item.checked_at) || 0,
            })
            count++
        }
        await shopping_list.refresh()
        return count
    }

    async deleteAll() {
        if (this.delete_all_open) return // 빠르게 두 번 눌러 확인창이 겹치지 않게
        this.delete_all_open = true
        try {
            await this.confirmAndDeleteAll()
        } finally {
            this.delete_all_open = false
        }
    }

    async confirmAndDeleteAll() {
        const total = await idb.doCountTotal('recipe')
        if (!total) return ui.toast('지울 레시피가 없어요')
        const ok = await ui.confirmTyped(
            `레시피 ${total}개를 모두 삭제할까요?\n삭제하면 되돌릴 수 없어요. 먼저 백업을 내보내는 걸 권해요.`,
            '정말로 전체 삭제',
            { ok: '모두 삭제' })
        if (!ok) return
        await idb.doTruncate('recipe')
        await this.reload()
        ui.toast('모두 삭제했어요')
    }
}

const recipe_book = new RecipeBook()
