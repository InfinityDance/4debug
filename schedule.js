// schedule.js

// URL веб-приложения
const API_URL = 'https://script.google.com/macros/s/AKfycbxcLHdtADSc8VGWiHM8aqBT_b-7CMSt9CYTnpP_VjZlr7FgPy-yVx3YMuUi06GbDMMGoQ/exec';

// ===== Преобразование времени =====
function formatTimeFromDate(dateString) {
    if (!dateString) return '';
    if (/^\d{2}:\d{2}$/.test(dateString)) return dateString;
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    } catch (e) {
        return '';
    }
}

// ===== Загрузка данных =====
async function loadSchedule() {
    const status = document.getElementById('schedule-status');
    if (status) status.textContent = 'Загрузка...';

    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error(`Ошибка HTTP: ${response.status}`);
        const data = await response.json();
        renderSchedule(data);
        if (status) status.textContent = '';
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        if (status) status.textContent = 'Не удалось загрузить расписание. Попробуйте позже.';
    }
}

// ===== Отрисовка таблицы =====
function renderSchedule(data) {
    const tbody = document.querySelector('#dynamic-schedule tbody');
    if (!tbody) {
        console.error('Таблица не найдена');
        return;
    }
    tbody.innerHTML = '';

    if (!data || data.length === 0) {
        const row = tbody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 8;
        cell.textContent = 'Нет данных о занятиях';
        return;
    }

    // ---- 1. Автоматические даты текущей недели ----
    const daysOfWeek = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    const dateMap = {};
    const today = new Date();
    const currentDay = today.getDay(); // 0 = вс, 1 = пн, ...
    const monday = new Date(today);
    monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1));
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const dayNum = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        dateMap[daysOfWeek[i]] = `${dayNum}.${month}`;
    }

    // Обновляем заголовки
    const dayHeaders = document.querySelectorAll('#dynamic-schedule thead th .date');
    dayHeaders.forEach((span, index) => {
        const day = daysOfWeek[index];
        if (day && dateMap[day]) {
            span.textContent = dateMap[day];
        }
    });

    // ---- 2. Построение карты занятий с фильтром Active ----
    const lessonMap = {};
    data.forEach(item => {
        // Проверка Active (если колонка существует)
        const active = item.Active !== undefined ? item.Active : item.active;
        if (active !== undefined) {
            // Если Active = false, 'FALSE', 'false' или пусто – пропускаем
            if (active === false || active === 'FALSE' || active === 'false' || active === '') {
                return;
            }
        }

        const day = item.Day || item.day || '';
        let time = '';
        if (item.Time) {
            time = formatTimeFromDate(item.Time);
        } else if (item.time) {
            time = formatTimeFromDate(item.time);
        }
        if (!day || !time) return;

        const key = `${day}|${time}`;
        lessonMap[key] = {
            lesson: item.Lesson || item.lesson || '',
            teacher: item.Teacher || item.teacher || '',
            booked: item.Booked || item.booked || 0,
            total: item.Total || item.total || 10
        };
    });

    // ---- 3. Генерация строк таблицы ----
    const times = [];
    for (let hour = 9; hour <= 21; hour++) {
        const h = String(hour).padStart(2, '0');
        times.push(`${h}:00`);
    }

    times.forEach(time => {
        const row = tbody.insertRow();
        const timeCell = row.insertCell();
        timeCell.className = 'time-col';
        const nextHour = String(Number(time.split(':')[0]) + 1).padStart(2, '0');
        timeCell.textContent = `${time} – ${nextHour}:00`;

        daysOfWeek.forEach(day => {
            const cell = row.insertCell();
            const key = `${day}|${time}`;
            const lesson = lessonMap[key];

            if (lesson) {
                cell.className = 'lesson-cell';
                cell.innerHTML = `
                    ${lesson.lesson}
                    <span class="teacher">${lesson.teacher}</span>
                    <span class="count">${lesson.booked}/${lesson.total}</span>
                `;
            } else {
                cell.className = 'empty-cell';
                cell.textContent = '—';
            }
        });
    });
}

// ===== Запуск =====
document.addEventListener('DOMContentLoaded', loadSchedule);
