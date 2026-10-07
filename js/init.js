class RecipeBookInit {
    activeServiceWorker() {
        if (!('serviceWorker' in navigator)) return
        // 새 버전의 서비스워커가 이 화면을 넘겨받으면 한 번 새로고침해서 새 파일을 보여 줌.
        // (처음 설치될 때는 넘겨받을 이전 버전이 없으므로 새로고침하지 않음)
        const had_controller = !!navigator.serviceWorker.controller
        let reloaded = false
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!had_controller || reloaded) return
            reloaded = true
            // 뭔가 쓰는 중이면 방해하지 않음
            if (ui.popup_open || ui.sheet || document.querySelector('.dialog-overlay')) {
                return ui.toast('새 버전이 준비됐어요. 앱을 다시 열면 적용돼요')
            }
            location.reload()
        })
        window.addEventListener('load', () => {
            // updateViaCache: 'none' = 서비스워커 파일 자체도 브라우저 보관함을 거치지 않고 확인
            navigator.serviceWorker.register('service-worker.js', { updateViaCache: 'none' })
                .then((reg) => {
                    console.log('Service worker registered', reg.scope)
                    // 설치한 앱은 껐다 켜도 '새로 열기'가 아닐 수 있어서, 화면으로 돌아올 때마다 새 버전을 확인
                    document.addEventListener('visibilitychange', () => {
                        if (document.visibilityState === 'visible') reg.update().catch(() => {})
                    })
                })
                .catch(err => console.log(err))
        })
    }

    bindTopBar() {
        $('.search-btn').addEventListener('click', () => {
            const banner = $('.search-banner')
            const opened = !banner.classList.toggle('collapse-y')
            $('.search-btn').classList.toggle('active', opened)
            // 검색창이 열려 있으면 분류 탭이 그 아래에 붙도록 높이를 알려 줌
            document.documentElement.style.setProperty('--search-h', opened ? `${banner.scrollHeight}px` : '0px')
            if (opened) $('#recipe-searcher').focus({ preventScroll: true }) // 보던 위치 그대로
        })
        $('.filter-toggle').addEventListener('click', () => {
            const closed = $('.filter-panel').classList.toggle('collapse-y')
            $('.filter-toggle').classList.toggle('active', !closed)
        })
        $('.recipe-writer').addEventListener('click', () => recipe_book.renderEditor())
        $('.menu-btn').addEventListener('click', () => ui.toggleDrawer())
        $('.menu-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) ui.setDrawer(false)
        })

        let search_timer
        $('#recipe-searcher').addEventListener('input', (e) => {
            $('.search-deleter').classList.toggle('hide', !e.target.value)
            clearTimeout(search_timer)
            search_timer = setTimeout(() => {
                recipe_book.filter.q = e.target.value
                recipe_book.render()
            }, 150)
        })
        $('.search-deleter').addEventListener('click', () => {
            $('#recipe-searcher').value = ''
            $('.search-deleter').classList.add('hide')
            recipe_book.filter.q = ''
            recipe_book.render()
            $('#recipe-searcher').focus()
        })
    }

    bindFilter() {
        $('.filter-panel').addEventListener('click', (e) => {
            const tag = e.target.closest('[data-filter-tag]')
            if (tag) return recipe_book.toggleFilterTag(tag.dataset.filterKind, tag.dataset.filterTag)
            if (e.target.closest('.favorite-filter')) {
                recipe_book.filter.favorite = !recipe_book.filter.favorite
                return recipe_book.render()
            }
            if (e.target.closest('.ingredient-mode')) {
                recipe_book.filter.ingredient_mode = recipe_book.filter.ingredient_mode === 'all' ? 'any' : 'all'
                return recipe_book.render()
            }
            if (e.target.closest('.filter-reset')) recipe_book.resetFilter()
        })
        $('#sort-select').addEventListener('change', (e) => {
            recipe_config.set('sort', e.target.value)
            recipe_book.renderCards()
        })
    }

    bindCards() {
        $('.category-tabs').addEventListener('click', (e) => {
            const tab = e.target.closest('[data-category]')
            if (tab) recipe_book.setCategory(tab.dataset.category)
        })

        const container = $('.recipe-container')
        container.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]')
            if (action?.dataset.action === 'write') return recipe_book.renderEditor()
            if (action?.dataset.action === 'reset-filter') return recipe_book.resetFilter()
            const card = e.target.closest('.recipe-card')
            if (card) recipe_book.renderDetail(Number(card.dataset.id))
        })
        container.addEventListener('keydown', (e) => {
            const card = e.target.closest('.recipe-card')
            if (card && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault()
                recipe_book.renderDetail(Number(card.dataset.id))
            }
        })
    }

    bindPopup() {
        $('.popup-overlay .close').addEventListener('click', () => ui.closePopup())
        $('.popup-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) ui.closePopup()
        })
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape' || $('.dialog-overlay')) return
            if (ui.sheet) return ui.closeSheet(null) // 선택창이 떠 있으면 그것부터
            if (ui.popup_open) ui.closePopup()
        })

        const popup = $('.popup')
        popup.addEventListener('click', async (e) => {
            // 메모 속 외부 링크: 이동 전에 한 번 묻습니다.
            const link = e.target.closest('a[data-ext-link]')
            if (link) {
                e.preventDefault()
                const url = link.getAttribute('href')
                const ok = await ui.confirm(`외부 링크로 이동할까요?\n${url}`, { ok: '예', cancel: '아니오' })
                if (ok) window.open(url, '_blank', 'noopener,noreferrer')
                return
            }

            // 식사 일기 창 (레시피 편집기의 사진 버튼과 겹치지 않게 먼저 처리)
            if (e.target.closest('.diary')) {
                const tab = e.target.closest('[data-diary-tab]')
                if (tab) return tab.disabled ? null : meal_plan.switchDiaryTab(tab.dataset.diaryTab)
                const pick = e.target.closest('[data-diary-pick]')
                if (pick) return meal_plan.pickDiaryMark(pick.dataset.diaryPick)
                if (e.target.closest('[data-diary-cancel]')) return meal_plan.cancelDiaryEdit()
                if (e.target.closest('[data-diary-photo-remove]')) {
                    e.preventDefault()
                    return meal_plan.setDiaryPhoto(null)
                }
                if (e.target.closest('[data-diary-save]')) return meal_plan.saveDiary()
                if (e.target.closest('[data-diary-clear]')) return meal_plan.clearDiary()
            }

            const action = e.target.closest('[data-action]')
            if (action) {
                const id = Number(action.dataset.id)
                switch (action.dataset.action) {
                    case 'favorite': return recipe_book.toggleFavorite(id)
                    case 'edit': return recipe_book.renderEditor(id)
                    case 'delete': return recipe_book.deleteRecipe(id)
                    case 'editor-cancel': return ui.closePopup()
                    case 'lottery-again': return recipe_book.drawLottery()
                    case 'lottery-open': return recipe_book.renderDetail(id)
                    case 'meal-save': return meal_plan.save()
                    case 'meal-cancel': return ui.closePopup()
                    case 'diary-edit': return meal_plan.renderDiary('edit')
                    case 'goto-tag': {
                        // 상세에서 태그를 누르면 그 태그로 목록 필터
                        const had_entry = ui.popup_entry
                        ui.hidePopup()
                        if (had_entry) ui.silentBack()
                        this.switchView('recipes') // 식단 일기의 레시피 탭에서 눌렀을 수도 있음
                        recipe_book.filter[action.dataset.kind].add(action.dataset.tag)
                        $('.filter-panel').classList.remove('collapse-y')
                        $('.filter-toggle').classList.add('active')
                        return recipe_book.render()
                    }
                }
            }

            // 식단 추가 - 추천 레시피 이름 누르면 입력칸에 채움
            const pick = e.target.closest('[data-meal-pick]')
            if (pick) {
                const input = $('.popup-content .meal-name-input')
                input.value = pick.dataset.mealPick
                meal_plan.renderSuggest()
                return input.focus()
            }

            // 편집기 - 만드는 방법 단계
            const step_btn = e.target.closest('[data-step]')
            if (step_btn) {
                const li = step_btn.closest('li')
                const kind = step_btn.dataset.step
                if (kind === 'up' && li.previousElementSibling) li.previousElementSibling.before(li)
                if (kind === 'down' && li.nextElementSibling) li.nextElementSibling.after(li)
                if (kind === 'del') {
                    if ($$('.step-editor > li').length > 1) li.remove()
                    else $('textarea', li).value = ''
                }
                return recipe_book.renumberSteps()
            }
            if (e.target.closest('.add-step')) {
                const li = recipe_book.addStepRow()
                $('textarea', li).focus()
                return
            }
            if (e.target.closest('.photo-remove')) {
                e.preventDefault()
                return recipe_book.setPhoto(null)
            }
        })

        // 만드는 방법·팁 칸은 쓰는 만큼 늘어나고 지우면 줄어듭니다.
        popup.addEventListener('input', (e) => {
            if (e.target.matches('.editor textarea, .diary-note')) autoGrow(e.target)
            if (e.target.matches('.meal-name-input')) meal_plan.renderSuggest()
        })
        // 화면 폭이 바뀌면(가로 회전 등) 줄바꿈이 달라지니 다시 맞춤
        window.addEventListener('resize', () => $$('.popup-content .editor textarea, .popup-content .diary-note').forEach(autoGrow))

        popup.addEventListener('change', (e) => {
            // 식단 추가: 끼니를 고르면 바로 이름을 적을 수 있게
            if (e.target.name === 'meal_slot') return $('.popup-content .meal-name-input')?.focus()
            if (e.target.matches('.diary-photo-input') && e.target.files[0]) {
                meal_plan.setDiaryPhoto(e.target.files[0])
                e.target.value = ''
            }
            if (e.target.matches('.photo-input') && e.target.files[0]) {
                recipe_book.setPhoto(e.target.files[0])
                e.target.value = ''
            }
        })

        popup.addEventListener('submit', (e) => {
            e.preventDefault()
            recipe_book.saveRecipe()
        })

        // 편집기 입력칸에서 Enter로 폼이 제출되지 않도록 (태그 입력기가 Enter를 씀)
        popup.addEventListener('keydown', (e) => {
            // 식단 이름 칸 Enter → 추가 (한글 조합 중 Enter는 무시)
            if (e.key === 'Enter' && !e.isComposing && e.target.matches('.meal-name-input')) {
                e.preventDefault()
                return meal_plan.save()
            }
            if (e.key === 'Enter' && e.target.matches('.editor input:not([type=file])')) e.preventDefault()
            // 단계 입력칸에서 Ctrl/Cmd + Enter → 다음 단계 추가
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.target.matches('.step-editor textarea')) {
                e.preventDefault()
                const li = recipe_book.addStepRow('', e.target.closest('li'))
                $('textarea', li).focus()
            }
        })
    }

    // 아래 탭: 레시피 | 식단 | 장바구니
    bindViews() {
        $('.bottom-nav').addEventListener('click', (e) => {
            const btn = e.target.closest('[data-view]')
            if (btn) this.switchView(btn.dataset.view)
        })
    }

    switchView(view) {
        if (!['recipes', 'meals', 'shopping'].includes(view)) view = 'recipes'
        const changed = document.body.dataset.view !== view
        document.body.dataset.view = view
        $$('.bottom-nav [data-view]').forEach(b => b.dataset.view === view ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'))
        if (changed) window.scrollTo(0, 0)
        recipe_config.set('view', view)
        if (view === 'meals') meal_plan.render()
        if (view === 'shopping') shopping_list.render()
    }

    bindShopping() {
        const view = $('.view-shopping')
        view.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]')
            if (!action) return
            const id = Number(action.dataset.id)
            switch (action.dataset.action) {
                case 'shop-add': return shopping_list.addFromInput()
                case 'shop-toggle': return shopping_list.toggle(id)
                case 'shop-del': return shopping_list.remove(id)
                case 'shop-clear-checked': return shopping_list.clearChecked()
            }
        })
        // 장바구니 입력칸 Enter → 추가 (한글 조합 중 Enter는 무시)
        view.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.isComposing && e.target.matches('.shop-input')) {
                e.preventDefault()
                shopping_list.addFromInput()
            }
        })
    }

    // 스티커 그림 파일이 없거나 못 불러오면 깨진 아이콘 대신 빈칸으로
    bindStickerFallback() {
        document.addEventListener('error', (e) => {
            if (e.target instanceof HTMLImageElement && e.target.classList.contains('sticker')) e.target.classList.add('broken')
        }, true) // error 이벤트는 위로 전파되지 않아서 capture로 받음
    }

    bindMeals() {
        const view = $('.view-meals')
        view.addEventListener('click', (e) => {
            const week = e.target.closest('[data-meal-week]')
            if (week) return meal_plan.moveWeek(Number(week.dataset.mealWeek))
            const add = e.target.closest('[data-meal-add]')
            if (add) return meal_plan.openAdd(add.dataset.mealAdd)
            if (e.target.closest('[data-meal-clear-old]')) return meal_plan.clearOld()
            const del = e.target.closest('[data-meal-del]')
            if (del) return meal_plan.remove(Number(del.dataset.mealDel))
            const open = e.target.closest('[data-meal-open]')
            if (open) return meal_plan.openDiary(Number(open.dataset.mealOpen))
        })
        view.addEventListener('keydown', (e) => {
            const open = e.target.closest('[data-meal-open]')
            if (open && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault()
                meal_plan.openDiary(Number(open.dataset.mealOpen))
            }
        })
    }

    bindLottery() {
        $('.lottery-fab').addEventListener('click', () => recipe_book.drawLottery())
    }

    bindMenu() {
        $('.menu-screen').addEventListener('change', (e) => {
            if (e.target.name === 'app_theme') {
                recipe_config.set('app_theme', e.target.value)
                recipe_book.applyTheme(e.target.value)
                recipe_book.renderCards()
            }
            if (e.target.name === 'card_layout') {
                recipe_config.set('card_layout', e.target.value)
                recipe_book.applyLayout(e.target.value)
            }
            if (e.target.matches('#import-file') && e.target.files[0]) {
                recipe_book.importBackup(e.target.files[0])
                e.target.value = ''
            }
        })
        $('.export-btn').addEventListener('click', () => recipe_book.exportBackup())
        $('.import-btn').addEventListener('click', () => $('#import-file').click())
        $('.delete-all-btn').addEventListener('click', () => recipe_book.deleteAll())
        $('.app-version').textContent = `v${APP_CONFIG.app_version}`
    }
}

const init_svc = new RecipeBookInit()
init_svc.activeServiceWorker()

document.addEventListener('DOMContentLoaded', async () => {
    init_svc.bindTopBar()
    init_svc.bindFilter()
    init_svc.bindCards()
    init_svc.bindPopup()
    init_svc.bindMenu()
    init_svc.bindLottery()
    init_svc.bindShopping()
    init_svc.bindMeals()
    init_svc.bindStickerFallback()
    init_svc.bindViews()
    // 넓은 화면에서는 필터 패널을 펼쳐 둡니다.
    if (window.matchMedia('(min-width: 769px)').matches) {
        $('.filter-panel').classList.remove('collapse-y')
        $('.filter-toggle').classList.add('active')
    }
    try {
        await recipe_book.init()
        await shopping_list.load()
        init_svc.switchView(recipe_config.get('view')) // 마지막으로 보던 탭
    } catch (e) {
        console.error(e)
        $('.recipe-container').innerHTML = `<div class="empty-state"><p>저장소(IndexedDB)를 열 수 없어요.<br>시크릿 모드라면 일반 창에서 열어 주세요.</p></div>`
    }
})
