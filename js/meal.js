/**
 * 식단 - 한 주(월~일) 단위로 끼니별 요리 이름을 적어 둡니다.
 * 기록: { id, date: 'YYYY-MM-DD', slot, title, recipe_id, created_at }
 */
const MEAL_SLOTS = ['아침', '점심', '저녁', '간식', '야식']
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

// 기기 현지 날짜 기준 'YYYY-MM-DD' (toISOString은 UTC라 한국 새벽에 날짜가 밀림)
function dateKey(date) {
    const p = n => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
}

function mondayOf(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    return d
}

function addDays(date, days) {
    const d = new Date(date)
    d.setDate(d.getDate() + days)
    return d
}

class MealPlan {
    week_start = mondayOf(new Date())
    meals = []

    weekDays() {
        return Array.from({ length: 7 }, (_, i) => addDays(this.week_start, i))
    }

    async load() {
        const days = this.weekDays()
        this.meals = await idb.doSelectRange('meal', 'date', dateKey(days[0]), dateKey(days[6]))
    }

    async render() {
        await this.load()
        const today = dateKey(new Date())
        const days = this.weekDays()
        const is_this_week = dateKey(this.week_start) === dateKey(mondayOf(new Date()))
        const label = (d) => `${d.getMonth() + 1}월 ${d.getDate()}일`

        const day_cards = days.map(d => {
            const key = dateKey(d)
            const meals = this.meals
                .filter(m => m.date === key)
                .sort((a, b) => MEAL_SLOTS.indexOf(a.slot) - MEAL_SLOTS.indexOf(b.slot) || a.created_at - b.created_at)
            return `
            <section class="meal-day ${key === today ? 'today' : ''}" data-date="${key}">
                <div class="meal-day-head">
                    <span class="meal-weekday ${d.getDay() === 0 ? 'sun' : d.getDay() === 6 ? 'sat' : ''}">${WEEKDAYS[d.getDay()]}</span>
                    <span class="meal-date">${d.getMonth() + 1}/${d.getDate()}</span>
                    ${key === today ? `<span class="meal-today">오늘</span>` : ''}
                    <button type="button" class="icon-btn meal-add" data-meal-add="${key}" aria-label="${label(d)} 식단 추가"><i class="fas fa-plus"></i></button>
                </div>
                ${meals.length ? `<ul class="meal-list">${meals.map(m => `
                    <li>
                        <span class="meal-slot">${esc(m.slot)}</span>
                        <span class="meal-title ${m.recipe_id ? 'linked' : ''}" ${m.recipe_id ? `data-meal-recipe="${m.recipe_id}" role="button" tabindex="0"` : ''}>${esc(m.title)}</span>
                        <button type="button" class="icon-btn meal-del" data-meal-del="${m.id}" aria-label="${esc(m.title)} 삭제"><i class="fas fa-times"></i></button>
                    </li>`).join('')}</ul>` : ''}
            </section>`
        }).join('')

        $('.view-meals').innerHTML = `
            <div class="meal-week-nav">
                <button type="button" class="icon-btn" data-meal-week="-1" aria-label="지난주"><i class="fas fa-chevron-left"></i></button>
                <div class="meal-week-label">${label(days[0])} – ${label(days[6])}</div>
                <button type="button" class="icon-btn" data-meal-week="1" aria-label="다음주"><i class="fas fa-chevron-right"></i></button>
                <button type="button" class="text-btn meal-this-week ${is_this_week ? 'hide' : ''}" data-meal-week="0">이번 주</button>
            </div>
            <div class="meal-days">${day_cards}</div>`
    }

    moveWeek(step) {
        this.week_start = step === 0 ? mondayOf(new Date()) : addDays(this.week_start, step * 7)
        this.render()
    }

    // 식단 추가 창: 끼니 고르기 + 요리 이름 (저장된 레시피 이름을 추천)
    openAdd(date_key) {
        const [y, m, d] = date_key.split('-').map(Number)
        const date = new Date(y, m - 1, d)
        const last_slot = MEAL_SLOTS.includes(recipe_config.get('meal_slot')) ? recipe_config.get('meal_slot') : '점심'
        this.adding_date = date_key

        ui.openPopup({
            variant: 'meal',
            title: `${m}/${d} (${WEEKDAYS[date.getDay()]}) 식단 추가`,
            content: `
                <div class="meal-form">
                    <div class="segmented meal-slots" role="radiogroup" aria-label="끼니">
                        ${MEAL_SLOTS.map(s => `
                        <label>
                            <input type="radio" name="meal_slot" value="${s}" ${s === last_slot ? 'checked' : ''}>
                            <span>${s}</span>
                        </label>`).join('')}
                    </div>
                    <input type="text" class="meal-name-input" placeholder="요리 이름 (예: 제육볶음)" maxlength="60" enterkeyhint="done" autocomplete="off">
                    <div class="tag-suggest meal-suggest"></div>
                    <div class="dialog-btns">
                        <button type="button" class="btn ghost" data-action="meal-cancel">취소</button>
                        <button type="button" class="btn primary" data-action="meal-save"><i class="fas fa-check"></i> 추가</button>
                    </div>
                </div>`,
        })
        this.renderSuggest()
        $('.meal-name-input').focus()
    }

    // 입력한 글자가 들어간 레시피 이름 (입력 전에는 즐겨찾기·최근 레시피 순)
    renderSuggest() {
        const input = $('.popup-content .meal-name-input')
        if (!input) return
        const q = input.value.trim()
        const titles = [...recipe_book.recipes]
            .sort((a, b) => (b.favorite - a.favorite) || (b.updated_at - a.updated_at))
            .map(r => r.title)
            .filter((t, i, arr) => arr.indexOf(t) === i && t !== q && (!q || t.includes(q)))
            .slice(0, 12)
        $('.popup-content .meal-suggest').innerHTML = titles
            .map(t => `<button type="button" class="chip" data-meal-pick="${esc(t)}">${esc(t)}</button>`)
            .join('')
    }

    async save() {
        const input = $('.popup-content .meal-name-input')
        const title = input.value.trim()
        if (!title) {
            ui.toast('요리 이름을 적어 주세요')
            return input.focus()
        }
        const slot = $('.popup-content input[name="meal_slot"]:checked')?.value || '점심'
        recipe_config.set('meal_slot', slot)
        const recipe = recipe_book.recipes.find(r => r.title === title)
        await idb.doInsert('meal', {
            ...idb.newRecord('meal'),
            date: this.adding_date,
            slot,
            title,
            recipe_id: recipe ? recipe.id : null,
            created_at: Date.now(),
        })
        ui.closePopup()
        await this.render()
    }

    async remove(id) {
        await idb.doDelete('meal', id)
        await this.render()
    }

    async openRecipe(recipe_id) {
        const recipe = await idb.doSelectOne('recipe', recipe_id)
        if (!recipe) return ui.toast('연결된 레시피가 지워졌어요')
        recipe_book.renderDetail(recipe_id)
    }
}

const meal_plan = new MealPlan()
