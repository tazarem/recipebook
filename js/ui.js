const $ = (selector, root = document) => root.querySelector(selector)
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)]

// 사용자가 입력한 문자열은 반드시 이걸 거쳐서 html에 넣습니다.
function esc(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

// 사진은 이 앱이 만든 data:image base64 형식만 허용합니다.
// (조작된 백업 파일의 photo 값으로 html 속성을 탈출하는 것을 막기 위함)
function safePhoto(photo) {
    return typeof photo === 'string' && /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/]+=*$/.test(photo) ? photo : null
}

class RecipeUIHandler {
    popup_open = false
    drawer = false
    before_close = null // 닫기 전에 확인할 함수 (편집 중 이탈 방지). false를 반환하면 닫지 않음

    constructor() {
        // 안드로이드 뒤로가기 / 브라우저 뒤로가기로 팝업, 메뉴를 닫습니다.
        window.addEventListener('popstate', async () => {
            if (this.popup_open) {
                if (this.before_close && !(await this.before_close())) {
                    history.pushState({ layer: 'popup' }, '')
                    return
                }
                this.hidePopup()
            } else if (this.drawer) {
                this.setDrawer(false, true)
            }
        })
    }

    // 팝업 열기. 이미 열려 있으면 내용만 교체합니다.
    // variant: 팝업 모양 (''=기본, 'lottery'=가운데 작은 카드)
    openPopup({ title = '', actions = '', content = '', before_close = null, variant = '' }) {
        $('.popup').dataset.variant = variant
        $('.popup-header .title').innerHTML = title
        $('.popup-header .actions').innerHTML = actions
        const content_el = $('.popup-content')
        content_el.innerHTML = content
        content_el.scrollTop = 0
        this.before_close = before_close

        if (!this.popup_open) {
            this.popup_open = true
            history.pushState({ layer: 'popup' }, '')
            $('.popup-overlay').classList.remove('hide')
            document.body.classList.add('no-scroll')
        }
    }

    // 닫기 버튼 → history.back() → popstate에서 실제로 닫힘
    closePopup() {
        if (this.popup_open) history.back()
    }

    hidePopup() {
        this.popup_open = false
        this.before_close = null
        $('.popup-overlay').classList.add('hide')
        $('.popup-content').innerHTML = ''
        $('.popup').dataset.variant = ''
        document.body.classList.remove('no-scroll')
    }

    toggleDrawer() {
        this.setDrawer(!this.drawer)
    }

    setDrawer(open, from_history = false) {
        if (this.drawer === open) return
        this.drawer = open
        $('.menu-overlay').classList.toggle('collapse-x', !open)
        $('.menu-btn').classList.toggle('active', open)
        if (from_history) return
        if (open) history.pushState({ layer: 'drawer' }, '')
        else history.back()
    }

    toast(message) {
        const el = document.createElement('div')
        el.className = 'toast'
        el.textContent = message
        $('.toast-zone').appendChild(el)
        setTimeout(() => el.classList.add('out'), 1800)
        setTimeout(() => el.remove(), 2200)
    }

    // window.confirm 대체 (PWA standalone에서도 테마에 맞게)
    confirm(message, { ok = '확인', cancel = '취소', danger = false } = {}) {
        return new Promise((res) => {
            const overlay = document.createElement('div')
            overlay.className = 'dialog-overlay'
            overlay.innerHTML = `
                <div class="dialog" role="alertdialog" aria-modal="true">
                    <div class="dialog-message">${esc(message)}</div>
                    <div class="dialog-btns">
                        <button type="button" class="btn ghost" data-v="0">${esc(cancel)}</button>
                        <button type="button" class="btn ${danger ? 'danger' : 'primary'}" data-v="1">${esc(ok)}</button>
                    </div>
                </div>`
            overlay.addEventListener('click', (e) => {
                const btn = e.target.closest('button')
                if (!btn && e.target !== overlay) return
                overlay.remove()
                res(btn ? btn.dataset.v === '1' : false)
            })
            document.body.appendChild(overlay)
            overlay.querySelector('[data-v="1"]').focus()
        })
    }
}

const ui = new RecipeUIHandler()
