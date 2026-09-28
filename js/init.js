class RecipeBookInit {
    activeServiceWorker() {
        if (!('serviceWorker' in navigator)) return
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('service-worker.js')
                .then(reg => console.log('Service worker registered', reg.scope))
                .catch(err => console.log(err))
        })
    }

    bindTopBar() {
        $('.search-btn').addEventListener('click', () => {
            const banner = $('.search-banner')
            const open = banner.classList.toggle('collapse-y')
            $('.search-btn').classList.toggle('active', !open)
            if (!open) $('#recipe-searcher').focus()
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
            if (e.key === 'Escape' && ui.popup_open && !$('.dialog-overlay')) ui.closePopup()
        })

        const popup = $('.popup')
        popup.addEventListener('click', async (e) => {
            const action = e.target.closest('[data-action]')
            if (action) {
                const id = Number(action.dataset.id)
                switch (action.dataset.action) {
                    case 'favorite': return recipe_book.toggleFavorite(id)
                    case 'edit': return recipe_book.renderEditor(id)
                    case 'delete': return recipe_book.deleteRecipe(id)
                    case 'editor-cancel': return ui.closePopup()
                    case 'goto-tag': {
                        // 상세에서 태그를 누르면 그 태그로 목록 필터
                        ui.hidePopup()
                        history.back()
                        recipe_book.filter[action.dataset.kind].add(action.dataset.tag)
                        $('.filter-panel').classList.remove('collapse-y')
                        $('.filter-toggle').classList.add('active')
                        return recipe_book.render()
                    }
                }
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

        popup.addEventListener('change', (e) => {
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
            if (e.key === 'Enter' && e.target.matches('.editor input:not([type=file])')) e.preventDefault()
            // 단계 입력칸에서 Ctrl/Cmd + Enter → 다음 단계 추가
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.target.matches('.step-editor textarea')) {
                e.preventDefault()
                const li = recipe_book.addStepRow('', e.target.closest('li'))
                $('textarea', li).focus()
            }
        })
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
    // 넓은 화면에서는 필터 패널을 펼쳐 둡니다.
    if (window.matchMedia('(min-width: 769px)').matches) {
        $('.filter-panel').classList.remove('collapse-y')
        $('.filter-toggle').classList.add('active')
    }
    try {
        await recipe_book.init()
    } catch (e) {
        console.error(e)
        $('.recipe-container').innerHTML = `<div class="empty-state"><p>저장소(IndexedDB)를 열 수 없어요.<br>시크릿 모드라면 일반 창에서 열어 주세요.</p></div>`
    }
})
