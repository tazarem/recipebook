/**
 * 태그 입력기
 * - Enter / 쉼표로 태그 추가, 빈 입력에서 Backspace로 마지막 태그 삭제
 * - 추천 태그(기존에 쓴 태그 + 기본값)를 눌러서 추가
 */
class TagInput {
    constructor(root, { values = [], suggestions = [], placeholder = '입력 후 Enter' } = {}) {
        this.root = root
        this.values = [...values]
        this.suggestions = [...new Set(suggestions)]
        this.root.classList.add('tag-input')
        this.root.innerHTML = `
            <div class="tag-box">
                <span class="tag-list"></span>
                <input type="text" enterkeyhint="done" placeholder="${esc(placeholder)}">
            </div>
            <div class="tag-suggest"></div>`
        this.input = $('input', root)
        this.bind()
        this.render()
    }

    bind() {
        this.input.addEventListener('keydown', (e) => {
            if (e.isComposing) return // 한글 조합 중 Enter 무시
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault()
                this.add(this.input.value)
            } else if (e.key === 'Backspace' && this.input.value === '' && this.values.length) {
                this.remove(this.values.length - 1)
            }
        })
        this.input.addEventListener('input', () => {
            if (this.input.value.includes(',')) {
                this.input.value.split(',').forEach(v => this.add(v, false))
                this.input.value = ''
            }
            this.renderSuggest()
        })
        this.input.addEventListener('blur', () => {
            if (this.input.value.trim()) this.add(this.input.value, false)
        })
        this.root.addEventListener('click', (e) => {
            const del = e.target.closest('[data-del]')
            if (del) return this.remove(Number(del.dataset.del))
            const sug = e.target.closest('[data-sug]')
            if (sug) {
                this.add(sug.dataset.sug)
                this.input.focus()
                return
            }
            if (e.target.closest('.tag-box')) this.input.focus()
        })
    }

    add(raw, keep_focus = true) {
        const value = String(raw).replace(/[,#]/g, '').trim()
        this.input.value = ''
        if (value && !this.values.includes(value)) this.values.push(value)
        this.render()
        if (keep_focus) this.input.focus()
    }

    remove(index) {
        this.values.splice(index, 1)
        this.render()
    }

    getValues() {
        if (this.input.value.trim()) this.add(this.input.value, false)
        return [...this.values]
    }

    render() {
        $('.tag-list', this.root).innerHTML = this.values.map((v, i) => `
            <span class="chip on">${esc(v)}<button type="button" class="chip-x" data-del="${i}" aria-label="${esc(v)} 삭제"><i class="fas fa-times"></i></button></span>
        `).join('')
        this.renderSuggest()
    }

    renderSuggest() {
        const q = this.input.value.trim()
        const list = this.suggestions
            .filter(s => !this.values.includes(s) && (!q || s.includes(q)))
            .slice(0, 20)
        $('.tag-suggest', this.root).innerHTML = list
            .map(s => `<button type="button" class="chip" data-sug="${esc(s)}">+ ${esc(s)}</button>`)
            .join('')
    }
}

/**
 * 재료 입력기 - 재료명(태그) + 양
 * 재료명은 태그처럼 검색/필터에 쓰이고, 양은 표시용 자유 텍스트입니다.
 */
class IngredientInput {
    constructor(root, { values = [], suggestions = [] } = {}) {
        this.root = root
        this.values = values.map(v => ({ name: v.name, amount: v.amount || '', optional: !!v.optional }))
        this.suggestions = [...new Set(suggestions)]
        this.root.classList.add('ingredient-input')
        this.root.innerHTML = `
            <ul class="ing-list"></ul>
            <div class="ing-row">
                <input type="text" class="ing-name" placeholder="재료명 (예: 돼지고기)" enterkeyhint="next">
                <input type="text" class="ing-amount" placeholder="양 (예: 300g)" enterkeyhint="done">
                <button type="button" class="icon-btn solid ing-add" aria-label="재료 추가"><i class="fas fa-plus"></i></button>
            </div>
            <div class="tag-suggest"></div>
            <div class="field-hint">"양파 1개, 대파 1/2대" 처럼 쉼표로 여러 개를 한 번에 넣을 수도 있어요.<br>
                없어도 되는 재료는 [선택]을 누르거나 "옥수수 2큰술 (선택)" 처럼 적어 주세요.</div>`
        this.name_input = $('.ing-name', root)
        this.amount_input = $('.ing-amount', root)
        this.bind()
        this.render()
    }

    bind() {
        this.name_input.addEventListener('keydown', (e) => {
            if (e.isComposing || e.key !== 'Enter') return
            e.preventDefault()
            if (this.name_input.value.includes(',')) return this.addFromInputs()
            this.amount_input.focus()
        })
        this.amount_input.addEventListener('keydown', (e) => {
            if (e.isComposing || e.key !== 'Enter') return
            e.preventDefault()
            this.addFromInputs()
        })
        this.name_input.addEventListener('input', () => this.renderSuggest())
        $('.ing-add', this.root).addEventListener('click', () => this.addFromInputs())

        this.root.addEventListener('click', (e) => {
            const del = e.target.closest('[data-del]')
            if (del) {
                this.values.splice(Number(del.dataset.del), 1)
                return this.render()
            }
            const opt = e.target.closest('[data-optional]')
            if (opt) {
                const v = this.values[Number(opt.dataset.optional)]
                v.optional = !v.optional
                return this.render()
            }
            const move = e.target.closest('[data-move]')
            if (move) {
                const [i, dir] = move.dataset.move.split(':').map(Number)
                const j = i + dir
                if (j < 0 || j >= this.values.length) return
                ;[this.values[i], this.values[j]] = [this.values[j], this.values[i]]
                return this.render()
            }
            const sug = e.target.closest('[data-sug]')
            if (sug) {
                this.name_input.value = sug.dataset.sug
                this.renderSuggest()
                this.amount_input.focus()
            }
        })
        this.root.addEventListener('input', (e) => {
            const amount = e.target.closest('[data-amount]')
            if (amount) this.values[Number(amount.dataset.amount)].amount = amount.value
        })
    }

    // "(선택)", "[선택]" 표시를 떼어내고 선택 재료 여부를 돌려줍니다.
    static stripOptional(text) {
        const OPTIONAL_MARK = /\s*[(\[]\s*선택\s*[)\]]\s*/g
        return { text: text.replace(OPTIONAL_MARK, ' ').trim(), optional: OPTIONAL_MARK.test(text) }
    }

    // "양파 1개, 대파 1/2대, 옥수수 (선택)" → [{양파, 1개}, {대파, 1/2대}, {옥수수, 선택}]
    static parse(raw) {
        const { text, optional } = IngredientInput.stripOptional(raw)
        // 숫자로 시작하거나(300g, 1/2개), 한글 수량으로 시작하는 뒷부분(반 캔, 한공기, 두스푼)을 양으로 봅니다.
        const m = text.match(/^(.+?)\s+([\d½⅓¼¾⅔.\/~]+.*|(?:반|한|두|세|네|다섯|여섯|몇)\s?\S+.*|약간|적당량|적당히|조금|취향껏|少々)$/)
        return m ? { name: m[1].trim(), amount: m[2].trim(), optional } : { name: text, amount: '', optional }
    }

    addFromInputs() {
        const name_raw = this.name_input.value
        const amount = this.amount_input.value.trim()
        if (name_raw.includes(',')) {
            name_raw.split(',').map(s => s.trim()).filter(Boolean)
                .forEach(chunk => this.push(IngredientInput.parse(chunk)))
        } else if (name_raw.trim()) {
            if (amount) {
                const name = IngredientInput.stripOptional(name_raw)
                const amt = IngredientInput.stripOptional(amount)
                this.push({ name: name.text, amount: amt.text, optional: name.optional || amt.optional })
            } else {
                this.push(IngredientInput.parse(name_raw))
            }
        }
        this.name_input.value = ''
        this.amount_input.value = ''
        this.render()
        this.name_input.focus()
    }

    push({ name, amount, optional = false }) {
        name = name.replace(/#/g, '').trim()
        if (!name) return
        const found = this.values.find(v => v.name === name)
        if (found) {
            found.amount = amount || found.amount
            found.optional = optional
        } else {
            this.values.push({ name, amount, optional })
        }
    }

    getValues() {
        if (this.name_input.value.trim()) this.addFromInputs()
        return this.values.filter(v => v.name).map(v => ({ name: v.name, amount: v.amount.trim(), optional: v.optional }))
    }

    render() {
        $('.ing-list', this.root).innerHTML = this.values.map((v, i) => `
            <li class="${v.optional ? 'optional' : ''}">
                <span class="chip on">${esc(v.name)}</span>
                <input type="text" class="ing-amount-inline" data-amount="${i}" value="${esc(v.amount)}" placeholder="양">
                <button type="button" class="opt-toggle ${v.optional ? 'on' : ''}" data-optional="${i}" aria-pressed="${v.optional}" title="없어도 되는 재료">선택</button>
                <button type="button" class="icon-btn" data-move="${i}:-1" aria-label="위로"><i class="fas fa-chevron-up"></i></button>
                <button type="button" class="icon-btn" data-move="${i}:1" aria-label="아래로"><i class="fas fa-chevron-down"></i></button>
                <button type="button" class="icon-btn" data-del="${i}" aria-label="${esc(v.name)} 삭제"><i class="fas fa-times"></i></button>
            </li>`).join('')
        this.renderSuggest()
    }

    renderSuggest() {
        const q = this.name_input.value.trim()
        const names = this.values.map(v => v.name)
        const list = this.suggestions
            .filter(s => !names.includes(s) && (!q || s.includes(q)))
            .slice(0, 16)
        $('.tag-suggest', this.root).innerHTML = list
            .map(s => `<button type="button" class="chip" data-sug="${esc(s)}">+ ${esc(s)}</button>`)
            .join('')
    }
}
