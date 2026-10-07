/**
 * 식단 - 한 주(월~일) 단위로 끼니별 요리 이름을 적어 둡니다.
 * 기록: { id, date: 'YYYY-MM-DD', slot, title, recipe_id, created_at }
 */
const MEAL_SLOTS = ['아침', '점심', '저녁', '간식', '야식']
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

// 맛 평가 (3단계, 색 태그로 표시)
const RATINGS = [
    { key: 'yum', label: '맛있었당~' },
    { key: 'ok', label: '나쁘지 않아' },
    { key: 'bad', label: '별로..' },
]
// v0.65의 4단계 평가(good·soso)는 '나쁘지 않아'로
function normalizeRating(value) {
    if (value === 'good' || value === 'soso') return 'ok'
    return RATINGS.some(r => r.key === value) ? value : ''
}

function ratingTagHtml(key, size = '') {
    const rating = RATINGS.find(r => r.key === normalizeRating(key))
    return rating ? `<span class="rating-tag ${rating.key} ${size}">${rating.label}</span>` : ''
}

// 꾸미기 스티커 (평가와 상관없이 도장처럼 찍는 것)
// 그림: img/stickers/sticker_1.png ~ sticker_N.png (N = config.js의 sticker_count), 없으면 기본 이모지
const DEFAULT_EMOJI_STICKERS = ['🐶', '🐱', '🐰', '🐻', '🐥', '🍚', '🍰', '☕', '💖', '⭐', '🔥', '💤']

function stickerList() {
    const count = Number(APP_CONFIG.sticker_count) || 0
    return count > 0 ? Array.from({ length: count }, (_, i) => `sticker_${i + 1}`) : DEFAULT_EMOJI_STICKERS
}

// 저장된 값이 'sticker_숫자'면 그림, 아니면 이모지 글자로 보여 줍니다.
// (이모지로 찍어 둔 옛 일기는 그림으로 바꾼 뒤에도 그대로 보임)
// tilted: true면 네 가지 기울기 중 하나를 그릴 때마다 무작위로 (저장하지 않음, 각도는 css의 .tilt-N)
const STICKER_TILT_COUNT = 4
function stickerHtml(value, size = '', tilted = false) {
    if (!value) return ''
    const tilt_class = tilted ? `tilt-${Math.floor(Math.random() * STICKER_TILT_COUNT)}` : ''
    return /^sticker_\d+$/.test(value)
        ? `<img class="sticker ${size} ${tilt_class}" src="./img/stickers/${value}.png" alt="스티커">`
        : `<span class="sticker emoji ${size} ${tilt_class}" role="img" aria-label="스티커">${esc(value)}</span>`
}

function safeSticker(value) {
    const v = String(value ?? '')
    // 'sticker_숫자' 또는 이모지(영문·숫자·기호가 섞이지 않은 짧은 글자)만 허용
    return /^sticker_\d+$/.test(v) || (v.length > 0 && v.length <= 16 && !/[\x00-\x7F]/.test(v)) ? v : ''
}

// 일기를 쓴 식단인지 (평가·스티커·한마디·사진 중 하나라도 있으면)
function hasDiary(meal) {
    return !!(normalizeRating(meal.rating) || meal.sticker || meal.note || meal.photo)
}

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
        const { meals: old_meals } = await this.oldMeals()
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
                        <span class="meal-title" data-meal-open="${m.id}" role="button" tabindex="0">${esc(m.title)} ${ratingTagHtml(m.rating, 'sm')}</span>
                        ${m.sticker ? stickerHtml(m.sticker, 'sm') : (m.note || m.photo) ? `<i class="far fa-comment-dots meal-has-diary" aria-label="일기 있음"></i>` : ''}
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
            <div class="meal-days">${day_cards}</div>
            ${old_meals.length ? `
            <div class="meal-clear">
                <button type="button" class="text-btn" data-meal-clear-old><i class="far fa-trash-alt"></i> 3주 전 식단 비우기 (${old_meals.length}개)</button>
            </div>` : ''}`
    }

    // 3주 전 주와 그 이전의 식단 (이번 주·지난주·2주 전은 남김)
    async oldMeals() {
        const keep_from = addDays(mondayOf(new Date()), -14) // 2주 전 월요일부터는 남김
        const until = addDays(keep_from, -1)                 // 그 전날(3주 전 일요일)까지 지움
        const all = await idb.doSelectRange('meal', 'date', '', dateKey(until))
        return { meals: all.filter(m => !hasDiary(m)), until } // 일기를 쓴 식단은 남김
    }

    async clearOld() {
        const { meals, until } = await this.oldMeals()
        if (!meals.length) return ui.toast('지울 3주 전 식단이 없어요')
        const ok = await ui.confirm(
            `${until.getMonth() + 1}월 ${until.getDate()}일까지의 식단 ${meals.length}개를 지울까요?\n이번 주와 지난 2주의 식단, 일기를 쓴 식단은 그대로 남아요. 지우면 되돌릴 수 없어요.`,
            { ok: '비우기', danger: true })
        if (!ok) return
        for (const meal of meals) await idb.doDelete('meal', meal.id)
        await this.render()
        ui.toast(`3주 전 식단 ${meals.length}개를 지웠어요`)
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
        const meal = await idb.doSelectOne('meal', id)
        if (meal && hasDiary(meal)) {
            const ok = await ui.confirm(`'${meal.title}'에 쓴 일기도 같이 지워져요.\n지울까요?`, { ok: '지우기', danger: true })
            if (!ok) return
        }
        await idb.doDelete('meal', id)
        await this.render()
    }

    /* ---------- 식사 일기 ---------- */
    // 식단의 음식을 누르면: [식사 일기] [레시피 보기] 탭이 있는 창
    // 일기가 있으면 조회 화면, 없으면 바로 쓰는 화면
    async openDiary(id, mode = null) {
        const meal = await idb.doSelectOne('meal', id)
        if (!meal) return
        const recipe = meal.recipe_id ? await idb.doSelectOne('recipe', meal.recipe_id) : null
        this.diary = { id, meal, recipe, mode: null, draft: null, snapshot: null }
        this.renderDiary(mode || (hasDiary(meal) ? 'view' : 'edit'))
    }

    renderDiary(mode) {
        const { meal, recipe } = this.diary
        const [, m, d] = meal.date.split('-').map(Number)
        const [y] = meal.date.split('-').map(Number)
        const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()]
        this.diary.mode = mode
        const editing = mode === 'edit'

        ui.openPopup({
            title: `${m}/${d} (${weekday}) ${esc(meal.slot)}`,
            actions: editing ? '' : `<button type="button" class="icon-btn" data-action="diary-edit" aria-label="일기 고치기"><i class="fas fa-pen"></i></button>`,
            before_close: editing ? () => this.confirmLeaveDiary() : null,
            content: `
                <div class="diary">
                    <div class="diary-tabs" role="tablist">
                        <button type="button" class="diary-tab on" role="tab" aria-selected="true" data-diary-tab="diary"><i class="fas fa-utensils"></i> 식사 일기</button>
                        <button type="button" class="diary-tab" role="tab" aria-selected="false" data-diary-tab="recipe" ${recipe ? '' : 'disabled title="연결된 레시피가 없어요"'}><i class="fas fa-book-open"></i> 레시피 보기</button>
                    </div>
                    <div class="diary-pane" data-diary-pane="diary">${editing ? this.diaryEditHtml() : this.diaryViewHtml()}</div>
                    <div class="diary-pane hide" data-diary-pane="recipe">
                        ${recipe ? `<h3 class="diary-food">${esc(recipe.title)}</h3>${recipe_book.detailContent(recipe)}` : ''}
                    </div>
                </div>`,
        })
        if (editing) {
            this.renderDiarySlots()
            autoGrow($('.popup-content .diary-note'))
            this.diary.snapshot = JSON.stringify(this.collectDiary())
        }
    }

    // 조회 화면: 적은 것만 보여 줌 (사진이 없으면 사진 칸도 없음)
    diaryViewHtml() {
        const { meal } = this.diary
        const rating = normalizeRating(meal.rating)
        const photo = safePhoto(meal.photo)
        return `
            <h3 class="diary-food">${esc(meal.title)}</h3>
            ${rating || meal.sticker ? `
            <div class="diary-marks">
                ${ratingTagHtml(rating)}
                ${stickerHtml(meal.sticker, 'lg', true)}
            </div>` : ''}
            ${photo ? `<img class="detail-photo" src="${esc(photo)}" alt="">` : ''}
            ${meal.note ? `<p class="detail-tips">${linkify(meal.note)}</p>` : ''}`
    }

    // 편집 화면: 평가·스티커는 ( + )를 눌러 아래에서 올라오는 선택창에서 고름
    diaryEditHtml() {
        const { meal } = this.diary
        const photo = safePhoto(meal.photo)
        this.diary.draft = {
            rating: normalizeRating(meal.rating),
            sticker: meal.sticker || '',
            photo,
        }
        return `
            <h3 class="diary-food">${esc(meal.title)}</h3>
            <div class="diary-slots">
                <div class="diary-slot">
                    <span class="field-label">맛 평가</span>
                    <button type="button" class="slot-btn" data-diary-pick="rating" aria-label="맛 평가 고르기"></button>
                </div>
                <div class="diary-slot">
                    <span class="field-label">스티커</span>
                    <button type="button" class="slot-btn" data-diary-pick="sticker" aria-label="스티커 고르기"></button>
                </div>
            </div>
            <label class="photo-picker ${photo ? 'has-photo' : ''}">
                <input type="file" accept="image/*" class="diary-photo-input" hidden>
                <img class="photo-preview" src="${esc(photo || '')}" alt="">
                <span class="photo-empty"><i class="fas fa-camera"></i> 사진 추가</span>
                <button type="button" class="icon-btn solid photo-remove" data-diary-photo-remove aria-label="사진 삭제"><i class="fas fa-times"></i></button>
            </label>
            <textarea class="diary-note" rows="3" maxlength="1000" placeholder="오늘 뭐 먹었나요? 어땠나요?">${esc(meal.note || '')}</textarea>
            <div class="diary-btns">
                ${hasDiary(meal) ? `<button type="button" class="text-btn" data-diary-clear><i class="far fa-trash-alt"></i> 일기 지우기</button>` : ''}
                <button type="button" class="btn ghost" data-diary-cancel>취소</button>
                <button type="button" class="btn primary" data-diary-save><i class="fas fa-check"></i> 저장</button>
            </div>`
    }

    // ( + ) 또는 고른 것 하나만 보여 줌
    renderDiarySlots() {
        const { rating, sticker } = this.diary.draft
        const plus = `<span class="slot-plus"><i class="fas fa-plus"></i></span>`
        const rating_btn = $('.popup-content [data-diary-pick="rating"]')
        const sticker_btn = $('.popup-content [data-diary-pick="sticker"]')
        if (!rating_btn) return
        rating_btn.innerHTML = rating ? ratingTagHtml(rating) : plus
        sticker_btn.innerHTML = sticker ? stickerHtml(sticker, 'lg', true) : plus
    }

    // 아래에서 올라오는 선택창에서 평가 또는 스티커 고르기
    async pickDiaryMark(kind) {
        const draft = this.diary.draft
        if (kind === 'rating') {
            const value = await ui.openSheet({
                title: '맛 평가',
                content: `
                    <div class="sheet-ratings">
                        ${RATINGS.map(r => `<button type="button" class="rating-tag ${r.key} ${draft.rating === r.key ? 'on' : ''}" data-sheet-value="${r.key}">${r.label}</button>`).join('')}
                    </div>
                    ${draft.rating ? `<button type="button" class="text-btn sheet-clear" data-sheet-value="">평가 안 함</button>` : ''}`,
            })
            if (value === null) return // 취소
            draft.rating = normalizeRating(value)
        } else {
            const value = await ui.openSheet({
                title: '스티커',
                content: `
                    <div class="sheet-stickers">
                        ${stickerList().map(v => `<button type="button" class="sticker-option ${draft.sticker === v ? 'on' : ''}" data-sheet-value="${esc(v)}" aria-label="스티커">${stickerHtml(v, 'lg')}</button>`).join('')}
                    </div>
                    ${draft.sticker ? `<button type="button" class="text-btn sheet-clear" data-sheet-value="">스티커 떼기</button>` : ''}`,
            })
            if (value === null) return
            draft.sticker = safeSticker(value)
        }
        this.renderDiarySlots()
    }

    switchDiaryTab(tab) {
        $$('.popup-content .diary-tab').forEach(b => {
            const on = b.dataset.diaryTab === tab
            b.classList.toggle('on', on)
            b.setAttribute('aria-selected', on)
        })
        $$('.popup-content .diary-pane').forEach(p => p.classList.toggle('hide', p.dataset.diaryPane !== tab))
        $('.popup-content').scrollTop = 0
    }

    async setDiaryPhoto(file) {
        try {
            this.diary.draft.photo = file ? await recipe_book.resizePhoto(file) : null
        } catch (e) {
            return ui.toast('사진을 불러오지 못했어요')
        }
        const picker = $('.popup-content .diary .photo-picker')
        picker.classList.toggle('has-photo', !!this.diary.draft.photo)
        $('.photo-preview', picker).src = this.diary.draft.photo || ''
    }

    collectDiary() {
        const note_el = $('.popup-content .diary-note')
        if (!note_el || !this.diary?.draft) return null
        const { rating, sticker, photo } = this.diary.draft
        return { rating, sticker, photo: photo || null, note: note_el.value.trim() }
    }

    isDiaryDirty() {
        const now = this.collectDiary()
        return !!now && JSON.stringify(now) !== this.diary.snapshot
    }

    async confirmLeaveDiary() {
        if (!this.isDiaryDirty()) return true
        return ui.confirm('쓰던 일기가 저장되지 않아요. 나갈까요?', { ok: '나가기', danger: true })
    }

    // 저장하면 조회 화면으로 (아무것도 안 적었으면 그냥 닫음)
    async saveDiary() {
        const data = this.collectDiary()
        await idb.doUpdatePartial('meal', this.diary.id, { ...data, diary_at: hasDiary(data) ? Date.now() : 0 })
        this.diary.meal = await idb.doSelectOne('meal', this.diary.id)
        await this.render()
        if (hasDiary(data)) {
            this.renderDiary('view')
            ui.toast('일기를 저장했어요')
        } else {
            ui.before_close = null
            ui.closePopup()
        }
    }

    // 편집 취소: 쓰던 일기가 있었으면 조회 화면으로, 없었으면 닫음
    async cancelDiaryEdit() {
        if (!(await this.confirmLeaveDiary())) return
        if (hasDiary(this.diary.meal)) return this.renderDiary('view')
        ui.before_close = null
        ui.closePopup()
    }

    async clearDiary() {
        const ok = await ui.confirm('이 식사의 일기(평가·스티커·사진·글)를 지울까요?\n식단에 적은 음식 이름은 남아요.', { ok: '일기 지우기', danger: true })
        if (!ok) return
        await idb.doUpdatePartial('meal', this.diary.id, { rating: '', sticker: '', note: '', photo: null, diary_at: 0 })
        ui.before_close = null
        ui.closePopup()
        await this.render()
        ui.toast('일기를 지웠어요')
    }
}

const meal_plan = new MealPlan()
