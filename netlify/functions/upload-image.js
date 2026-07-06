/**
 * Безпечно завантажує локальні медіа-файли та робить коміт у GitHub репозиторій
 * Шлях у проєкті: /netlify/functions/upload-image.js
 */
exports.handler = async function(event, context) {
    if (event.httpMethod !== "POST") {
        return { 
            statusCode: 405, 
            body: JSON.stringify({ message: "Метод не підтримується. Використовуйте POST." }) 
        };
    }

    try {
        const { password, fileName, fileContent } = JSON.parse(event.body);

        // Зчитуємо безпечні змінні оточення з Netlify
        const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
        const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
        const GITHUB_USERNAME = process.env.GITHUB_USERNAME;
        const GITHUB_REPO = process.env.GITHUB_REPO;

        if (!ADMIN_PASSWORD || !GITHUB_TOKEN || !GITHUB_USERNAME || !GITHUB_REPO) {
            return {
                statusCode: 500,
                body: JSON.stringify({ message: "Помилка конфігурації сервера. Налаштуйте змінні оточення в Netlify." })
            };
        }

        if (password !== ADMIN_PASSWORD) {
            return {
                statusCode: 401,
                body: JSON.stringify({ message: "Невірний пароль адміністратора! Завантаження заблоковано." })
            };
        }

        // Очищуємо ім'я файлу від небажаних символів та додаємо timestamp для унікальності
        const cleanName = Date.now() + "_" + fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
        const filePath = `images/${cleanName}`;
        
        const url = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${filePath}`;

        const putResponse = await fetch(url, {
            method: 'PUT',
            headers: {
                "Authorization": `token ${GITHUB_TOKEN}`,
                "Content-Type": "application/json",
                "User-Agent": "Netlify-Secure-Updater"
            },
            body: JSON.stringify({
                message: `media: upload image ${cleanName} via Admin Panel 📸`,
                content: fileContent, // Передаємо вже готову Base64 стрічку з фронтенду
                branch: "main"
            })
        });

        if (putResponse.ok) {
            return {
                statusCode: 200,
                body: JSON.stringify({ 
                    message: "Зображення успішно завантажено!", 
                    path: filePath 
                })
            };
        } else {
            const errData = await putResponse.json();
            return {
                statusCode: 500,
                body: JSON.stringify({ message: "Помилка GitHub API: " + (errData.message || "Невідома помилка") })
            };
        }

    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Внутрішня помилка сервера: " + error.message })
        };
    }
};