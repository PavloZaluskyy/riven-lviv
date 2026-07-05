const https = require('https');

// Універсальний клієнт без зовнішніх залежностей для сумісності з будь-якою версією Node.js
function githubRequest(url, method, token, data = null) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const options = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + parsedUrl.search,
            method: method,
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Netlify-Secure-Updater',
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    body: body
                });
            });
        });

        req.on('error', (err) => reject(err));

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

exports.handler = async function(event, context) {
    if (event.httpMethod !== "POST") {
        return { 
            statusCode: 405, 
            body: JSON.stringify({ message: "Метод не підтримується. Використовуйте POST." }) 
        };
    }

    try {
        const { password, html } = JSON.parse(event.body);

        const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
        const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
        const GITHUB_USERNAME = process.env.GITHUB_USERNAME;
        const GITHUB_REPO = process.env.GITHUB_REPO;
        const FILE_PATH = "index.html";

        if (!ADMIN_PASSWORD || !GITHUB_TOKEN || !GITHUB_USERNAME || !GITHUB_REPO) {
            return {
                statusCode: 500,
                body: JSON.stringify({ message: "Помилка конфігурації. Перевірте змінні оточення в панелі Netlify." })
            };
        }

        if (password !== ADMIN_PASSWORD) {
            return {
                statusCode: 401,
                body: JSON.stringify({ message: "Невірний пароль адміністратора! Доступ заблоковано." })
            };
        }

        const url = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${FILE_PATH}`;

        // Крок 1: Зчитуємо SHA файлу
        let sha = null;
        const getRes = await githubRequest(url, 'GET', GITHUB_TOKEN);
        if (getRes.statusCode === 200) {
            const fileData = JSON.parse(getRes.body);
            sha = fileData.sha;
        } else if (getRes.statusCode !== 404) {
            return {
                statusCode: 500,
                body: JSON.stringify({ message: `Не вдалося отримати SHA з GitHub (Код: ${getRes.statusCode}): ${getRes.body}` })
            };
        }

        // Крок 2: Пушимо оновлений HTML
        const putBody = {
            message: "feat: update content securely via Netlify Serverless Function 🛡️",
            content: Buffer.from(html, 'utf-8').toString('base64'),
            branch: "main"
        };
        if (sha) {
            putBody.sha = sha;
        }

        const putRes = await githubRequest(url, 'PUT', GITHUB_TOKEN, putBody);
        if (putRes.statusCode === 200 || putRes.statusCode === 201) {
            return {
                statusCode: 200,
                body: JSON.stringify({ message: "Сайт успішно оновлено!" })
            };
        } else {
            return {
                statusCode: 500,
                body: JSON.stringify({ message: `Помилка запису в GitHub (Код: ${putRes.statusCode}): ${putRes.body}` })
            };
        }

    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Помилка сервера: " + error.message })
        };
    }
};