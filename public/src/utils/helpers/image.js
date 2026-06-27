// ===================== src/utils/helpers/image.js =====================
// دوال ضغط الصور وتحويلها إلى Base64

import { showFloatingNotification } from './notifications.js';

export function compressImage(file, maxWidth = 400, maxHeight = 400, quality = 0.9) {
    return new Promise((resolve, reject) => {
        const fileType = file.type;
        const fileExt = file.name.split('.').pop().toLowerCase();
        if (fileType === 'image/svg+xml' || fileExt === 'svg') {
            reject(new Error('❌ لا يمكن رفع صور SVG'));
            showFloatingNotification('❌ لا يمكن رفع صور SVG، استخدم PNG أو JPEG', 'error', 3000);
            return;
        }
        if (!fileType.startsWith('image/')) {
            reject(new Error('الملف ليس صورة'));
            return;
        }
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);
                const compressed = canvas.toDataURL('image/png', quality);
                resolve(compressed);
            };
            img.onerror = (err) => reject(new Error('فشل تحميل الصورة: ' + err.message));
        };
        reader.onerror = (err) => reject(err);
    });
}