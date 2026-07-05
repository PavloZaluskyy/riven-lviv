/**
 * Secures GitHub API commits via Netlify Serverless Functions
 * Path: /netlify/functions/save-site.js
 */
exports.handler = async function(event, context) {
    // Дозволяємо лише POST-запити
    if (event.httpMethod !== "POST") {
        return { 
            statusCode: 405, 
            body: JSON.stringify({ message: "Метод не підтримується. Використовуйте POST." }) 
        };
    }

    try {
        // Розпаковуємо надіслані клієнтом дані
        const { password, html } = JSON.parse(event.body);

        // Зчитуємо безпечні змінні оточення з Netlify
        const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
        const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
        const GITHUB_USERNAME = process.env.GITHUB_USERNAME;
        const GITHUB_REPO = process.env.GITHUB_REPO;
        const FILE_PATH = "index.html";

        // Перевіряємо чи налаштовані всі змінні на хостингу
        if (!ADMIN_PASSWORD || !GITHUB_TOKEN || !GITHUB_USERNAME || !GITHUB_REPO) {
            return {
                statusCode: 500,
                body: JSON.stringify({ message: "Помилка конфігурації сервера. Змінні оточення не налаштовані в панелі Netlify." })
            };
        }

        // Перевіряємо відповідність пароля клієнта
        if (password !== ADMIN_PASSWORD) {
            return {
                statusCode: 401,
                body: JSON.stringify({ message: "Невірний пароль адміністратора! Доступ заблоковано." })
            };
        }

        const url = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${FILE_PATH}`;

        // Крок 1: Отримуємо поточний SHA файлу з репозиторію GitHub
        const getResponse = await fetch(url, {
            headers: {
                "Authorization": `token ${GITHUB_TOKEN}`,
                "Accept": "application/vnd.github.v3+json",
                "User-Agent": "Netlify-Secure-Updater"
            }
        });

        let sha = null;
        if (getResponse.ok) {
            const fileData = await getResponse.json();
            sha = fileData.sha;
        } else if (getResponse.status !== 404) {
            const errText = await getResponse.text();
            return {
                statusCode: 500,
                body: JSON.stringify({ message: "Не вдалося зчитати SHA файлу з GitHub: " + errText })
            };
        }

        // Крок 2: Оновлюємо вміст файлу index.html через безпечний PUT-запит
        const putBody = {
            message: "feat: update content securely via Netlify Serverless Function 🛡️",
            content: Buffer.from(html, 'utf-8').toString('base64'), // Надійне кодування UTF-8 у Base64
            branch: "main"
        };
        
        if (sha) {
            putBody.sha = sha;
        }

        const putResponse = await fetch(url, {
            method: 'PUT',
            headers: {
                "Authorization": `token ${GITHUB_TOKEN}`,
                "Content-Type": "application/json",
                "User-Agent": "Netlify-Secure-Updater"
            },
            body: JSON.stringify(putBody)
        });

        if (putResponse.ok) {
            return {
                statusCode: 200,
                body: JSON.stringify({ message: "Сайт успішно оновлено!" })
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