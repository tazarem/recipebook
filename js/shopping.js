/**
 * 장바구니 - 살 것을 적어 두고 체크하는 할 일 목록
 * 항목: { id, text, checked(0|1), created_at, checked_at }
 */
class ShoppingList {
    items = []

    async load() {
        this.items = await idb.doSelectAll('shopping')
        this.renderBadge()
    }

    // 안 산 것은 적은 순서대로, 산 것은 최근에 체크한 순서대로
    todo() {
        return this.items.filter(i => !i.checked).sort((a, b) => a.created_at - b.created_at)
    }

    done() {
        return this.items.filter(i => i.checked).sort((a, b) => b.checked_at - a.checked_at)
    }

    renderBadge() {
        $('.cart-btn .badge').textContent = this.todo().length || ''
    }

    open() {
        ui.openPopup({
            variant: 'shopping',
            title: `<i class="fas fa-shopping-cart"></i> 장바구니`,
            content: `
                <div class="shopping">
                    <div class="shop-add-row">
                        <input type="text" class="shop-input" placeholder="살 것 입력 (예: 우유, 달걀)" enterkeyhint="done" maxlength="100">
                        <button type="button" class="icon-btn solid" data-action="shop-add" aria-label="추가"><i class="fas fa-plus"></i></button>
                    </div>
                    <div class="field-hint">쉼표로 여러 개를 한 번에 넣을 수 있어요. 누르면 체크돼요.</div>
                    <div class="shop-body"></div>
                </div>`,
        })
        this.renderItems()
        // 목록이 비어 있을 때만 바로 입력 (휴대폰에서 체크하러 들어왔는데 키보드가 뜨지 않게)
        if (!this.items.length) $('.shop-input').focus()
    }

    renderItems() {
        const body = $('.popup-content .shop-body')
        if (!body) return
        const todo = this.todo()
        const done = this.done()
        const row = (i) => `
            <li class="${i.checked ? 'checked' : ''}">
                <button type="button" class="shop-item" data-action="shop-toggle" data-id="${i.id}" aria-pressed="${!!i.checked}">
                    <span class="shop-check"><i class="fas fa-check"></i></span>
                    <span class="shop-text">${esc(i.text)}</span>
                </button>
                <button type="button" class="icon-btn" data-action="shop-del" data-id="${i.id}" aria-label="${esc(i.text)} 삭제"><i class="fas fa-times"></i></button>
            </li>`

        if (!todo.length && !done.length) {
            body.innerHTML = `
                <div class="shop-empty">
                    <i class="fas fa-shopping-basket"></i>
                    <p>살 것을 적어 두세요.</p>
                </div>`
            return
        }
        body.innerHTML = `
            ${todo.length
                ? `<ul class="shop-list">${todo.map(row).join('')}</ul>`
                : `<div class="shop-all-done"><span class="emoji" aria-hidden="true">🎉</span> 다 샀어요!</div>`}
            ${done.length ? `
                <div class="shop-done-head">
                    <span>산 것 ${done.length}</span>
                    <button type="button" class="text-btn" data-action="shop-clear-checked"><i class="far fa-trash-alt"></i> 비우기</button>
                </div>
                <ul class="shop-list">${done.map(row).join('')}</ul>` : ''}`
    }

    async refresh() {
        this.items = await idb.doSelectAll('shopping')
        this.renderItems()
        this.renderBadge()
    }

    async addFromInput() {
        const input = $('.popup-content .shop-input')
        const texts = input.value.split(',').map(t => t.trim()).filter(Boolean)
        input.value = ''
        input.focus()
        if (!texts.length) return
        const now = Date.now()
        for (const [n, text] of texts.entries()) {
            const same = this.items.find(i => i.text === text)
            if (same && same.checked) {
                // 이미 산 것으로 있으면 다시 살 목록으로
                await idb.doUpdatePartial('shopping', same.id, { checked: 0, checked_at: 0, created_at: now + n })
            } else if (!same) {
                await idb.doInsert('shopping', { ...idb.newRecord('shopping'), text, created_at: now + n })
            }
        }
        await this.refresh()
    }

    async toggle(id) {
        const item = this.items.find(i => i.id === id)
        if (!item) return
        await idb.doUpdatePartial('shopping', id, item.checked
            ? { checked: 0, checked_at: 0 }
            : { checked: 1, checked_at: Date.now() })
        await this.refresh()
    }

    async remove(id) {
        await idb.doDelete('shopping', id)
        await this.refresh()
    }

    async clearChecked() {
        const done = this.done()
        if (!done.length) return
        const ok = await ui.confirm(`산 것 ${done.length}개를 목록에서 지울까요?`, { ok: '지우기', danger: true })
        if (!ok) return
        for (const item of done) await idb.doDelete('shopping', item.id)
        await this.refresh()
    }
}

const shopping_list = new ShoppingList()
