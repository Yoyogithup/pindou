function copyReviewLink() {
    const linkEl = document.getElementById('review-link');
    if (!linkEl) return;

    const link = linkEl.textContent;
    navigator.clipboard.writeText(link).then(() => {
        const btn = linkEl.nextElementSibling;
        const originalText = btn.textContent;
        btn.textContent = '已复制';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 1500);
    }).catch(err => {
        console.error('复制失败', err);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', () => {
            const btn = form.querySelector('button[type="submit"]');
            if (btn && !btn.disabled) {
                btn.disabled = true;
                const originalText = btn.textContent;
                btn.textContent = '处理中...';
                setTimeout(() => {
                    btn.disabled = false;
                    btn.textContent = originalText;
                }, 3000);
            }
        });
    });
});
