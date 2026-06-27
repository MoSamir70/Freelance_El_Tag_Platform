// src/landing/sections/testimonials.js
import { escapeHtml } from '../utils/helpers.js';

let comments = [];
let currentSort = 'newest';
let currentPage = 1;
const commentsPerPage = 4;

function loadCommentsFromStorage() {
    const saved = localStorage.getItem('taj_comments');
    if (saved) {
        comments = JSON.parse(saved);
    } else {
        comments = [];
        saveCommentsToStorage();
    }
    renderCommentsAndPagination();
    updateStats();
}

function saveCommentsToStorage() {
    localStorage.setItem('taj_comments', JSON.stringify(comments));
}

function updateStats() {
    const total = comments.length;
    const avgEl = document.getElementById('avgRatingDisplay');
    const starsEl = document.getElementById('avgStarsDisplay');
    const totalEl = document.getElementById('totalCommentsCount');
    
    if (total === 0) {
        if (avgEl) avgEl.innerText = '0.0';
        if (starsEl) starsEl.innerHTML = '☆☆☆☆☆';
        if (totalEl) totalEl.innerText = '0';
        return;
    }
    const sum = comments.reduce((acc, c) => acc + c.rating, 0);
    const avg = sum / total;
    if (avgEl) avgEl.innerText = avg.toFixed(1);
    if (totalEl) totalEl.innerText = total;
    
    let starsHtml = '';
    for (let i = 1; i <= 5; i++) {
        starsHtml += (i <= Math.round(avg)) ? '★' : '☆';
    }
    if (starsEl) starsEl.innerHTML = starsHtml;
}

function renderStars(rating) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
        html += i <= rating ? '★' : '☆';
    }
    return html;
}

function getSortedComments() {
    if (currentSort === 'newest') {
        return [...comments].sort((a, b) => new Date(b.time) - new Date(a.time));
    } else {
        return [...comments].sort((a, b) => b.rating - a.rating);
    }
}

function renderCommentsAndPagination() {
    const sorted = getSortedComments();
    const totalComments = sorted.length;
    const totalPages = Math.ceil(totalComments / commentsPerPage);
    const container = document.getElementById('commentsContainer');
    const paginationDiv = document.getElementById('paginationControls');
    const noCommentsDiv = document.getElementById('noComments');
    
    if (!container) return;
    
    if (totalComments === 0) {
        container.innerHTML = '';
        if (paginationDiv) paginationDiv.innerHTML = '';
        if (noCommentsDiv) noCommentsDiv.classList.remove('hidden');
        return;
    }
    if (noCommentsDiv) noCommentsDiv.classList.add('hidden');
    
    if (currentPage < 1) currentPage = 1;
    if (currentPage > totalPages) currentPage = totalPages;
    
    const start = (currentPage - 1) * commentsPerPage;
    const end = start + commentsPerPage;
    const commentsToShow = sorted.slice(start, end);
    
    const avatarColors = ['from-yellow-400 to-orange-500','from-purple-400 to-purple-700','from-cyan-400 to-blue-600','from-green-400 to-emerald-600','from-pink-400 to-rose-600'];
    
    container.innerHTML = commentsToShow.map((c, idx) => {
        const initial = c.name.trim().charAt(0) || '?';
        const colorIdx = Math.abs(c.name.length) % avatarColors.length;
        return `
            <div class="comment-card-user glass-card p-5 transition-all hover:scale-[1.02]">
                <div class="flex items-center gap-3 mb-3">
                    <div class="w-12 h-12 rounded-full bg-gradient-to-br ${avatarColors[colorIdx]} flex items-center justify-center text-xl font-black text-white flex-shrink-0">${escapeHtml(initial)}</div>
                    <div>
                        <div class="font-bold text-yellow-400 text-base">${escapeHtml(c.name)}</div>
                        <div class="text-gray-500 text-xs">${c.time}</div>
                    </div>
                </div>
                <p class="text-gray-300 text-sm leading-relaxed mb-2">${escapeHtml(c.text)}</p>
                <div class="text-yellow-400 text-lg">${renderStars(c.rating)}</div>
            </div>
        `;
    }).join('');
    
    if (!paginationDiv) return;
    if (totalPages <= 1) {
        paginationDiv.innerHTML = '';
        return;
    }
    
    let paginationHtml = '';
    paginationHtml += `<button data-page="prev" class="px-4 py-2 rounded-lg bg-purple-500/20 text-purple-300 hover:bg-purple-500/40 transition disabled:opacity-50" ${currentPage === 1 ? 'disabled' : ''}>السابق</button>`;
    
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);
    
    for (let i = startPage; i <= endPage; i++) {
        paginationHtml += `<button data-page="${i}" class="px-4 py-2 rounded-lg transition ${i === currentPage ? 'bg-yellow-500 text-black font-bold' : 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/40'}">${i}</button>`;
    }
    
    paginationHtml += `<button data-page="next" class="px-4 py-2 rounded-lg bg-purple-500/20 text-purple-300 hover:bg-purple-500/40 transition disabled:opacity-50" ${currentPage === totalPages ? 'disabled' : ''}>التالي</button>`;
    
    paginationDiv.innerHTML = paginationHtml;
    
    document.querySelectorAll('#paginationControls button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const pageVal = btn.getAttribute('data-page');
            if (pageVal === 'prev' && currentPage > 1) {
                currentPage--;
                renderCommentsAndPagination();
            } else if (pageVal === 'next' && currentPage < totalPages) {
                currentPage++;
                renderCommentsAndPagination();
            } else if (!isNaN(parseInt(pageVal))) {
                currentPage = parseInt(pageVal);
                renderCommentsAndPagination();
            }
        });
    });
}

function setupStarRating() {
    const stars = document.querySelectorAll('.star-select');
    const ratingInput = document.getElementById('selectedRating');
    if (!ratingInput) return;
    
    function updateStars(rating) {
        stars.forEach(s => {
            const starVal = parseInt(s.getAttribute('data-star'));
            if (starVal <= rating) {
                s.innerHTML = '★';
                s.classList.add('text-yellow-400');
                s.classList.remove('text-gray-500');
            } else {
                s.innerHTML = '☆';
                s.classList.add('text-gray-500');
                s.classList.remove('text-yellow-400');
            }
        });
    }
    
    stars.forEach(star => {
        star.addEventListener('click', function() {
            const value = parseInt(this.getAttribute('data-star'));
            ratingInput.value = value;
            updateStars(value);
        });
        star.addEventListener('mouseenter', function() {
            const value = parseInt(this.getAttribute('data-star'));
            updateStars(value);
        });
        star.addEventListener('mouseleave', function() {
            const current = parseInt(ratingInput.value);
            updateStars(current);
        });
    });
}

export function initTestimonials() {
    loadCommentsFromStorage();
    setupStarRating();
    
    const submitBtn = document.getElementById('submitComment');
    if (submitBtn) {
        submitBtn.addEventListener('click', () => {
            const name = document.getElementById('commentName')?.value.trim();
            const text = document.getElementById('commentText')?.value.trim();
            const rating = parseInt(document.getElementById('selectedRating')?.value || '0');
            
            if (!name || !text) {
                Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'يرجى إدخال الاسم والتعليق', background: '#1a1a2a', color: '#fff', confirmButtonColor: '#F59E0B' });
                return;
            }
            if (rating === 0) {
                Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'يرجى اختيار تقييم بالنجوم', background: '#1a1a2a', color: '#fff', confirmButtonColor: '#F59E0B' });
                return;
            }
            
            const newComment = {
                name: name,
                text: text,
                rating: rating,
                time: new Date().toLocaleString('ar-EG')
            };
            comments.unshift(newComment);
            saveCommentsToStorage();
            currentPage = 1;
            renderCommentsAndPagination();
            updateStats();
            
            if (document.getElementById('commentName')) document.getElementById('commentName').value = '';
            if (document.getElementById('commentText')) document.getElementById('commentText').value = '';
            if (document.getElementById('selectedRating')) document.getElementById('selectedRating').value = '0';
            document.querySelectorAll('.star-select').forEach(star => {
                star.innerHTML = '☆';
                star.classList.add('text-gray-500');
                star.classList.remove('text-yellow-400');
            });
            
            Swal.fire({ icon: 'success', title: 'شكراً لتقييمك!', text: 'تمت إضافة رأيك بنجاح', background: '#1a1a2a', color: '#fff', confirmButtonColor: '#F59E0B', timer: 2000, showConfirmButton: false });
        });
    }
    
    const sortNewest = document.getElementById('sortNewest');
    const sortTopRated = document.getElementById('sortTopRated');
    if (sortNewest) {
        sortNewest.addEventListener('click', () => {
            currentSort = 'newest';
            currentPage = 1;
            renderCommentsAndPagination();
            updateStats();
        });
    }
    if (sortTopRated) {
        sortTopRated.addEventListener('click', () => {
            currentSort = 'toprated';
            currentPage = 1;
            renderCommentsAndPagination();
            updateStats();
        });
    }
}