// schedule.js

// Импортируем библиотеку Supabase
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// ===== ВСТАВЬТЕ СЮДА ВАШИ ДАННЫЕ ИЗ SUPABASE =====
// Project URL
const SUPABASE_URL = 'https://tfsbxmeodpvnufbfznwr.supabase.co/rest/v1/';
// anon public key
const SUPABASE_ANON_KEY = 'sb_publishable_InwdKgbZv911V5rtxw_UjA_0tz0dyGX'; 
// ====================================================

// Создаем клиент для работы с базой данных
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Список дней недели для заголовков
const daysOfWeek = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

// Функция для загрузки расписания из Supabase
async function loadSchedule() {
    const status = document.getElementById('schedule-status');
    if (status) status.textContent = 'Загрузка...';

    // Запрашиваем данные из таблицы schedule, только активные занятия
    const { data, error } = await supabase
        .from('schedule')
        .select('*')
        .eq('is_active', true)
        .order('day', { ascending: true });

    if (error) {
        console.error('Ошибка загрузки:', error);
        if (status) status.textContent = 'Не удалось загрузить расписание.';
        return;
    }

    renderSchedule(data);
    if (status) status.textContent = '';
}

// Функция для отрисовки таблицы
function renderSchedule(data) {
    const tbody = document.querySelector('#dynamic-schedule tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    // Автоматические даты текущей недели
    const dateMap = {};
    const today = new Date();
    const currentDay = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1));
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        dateMap[daysOfWeek[i]] = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    // Обновляем заголовки с датами
    document.querySelectorAll('#dynamic-schedule thead th .date').forEach((span, index) => {
        const day = daysOfWeek[index];
        if (day && dateMap[day]) span.textContent = dateMap[day];
    });

    // Строим карту занятий для быстрого доступа
    const lessonMap = {};
    data.forEach(item => {
        const key = `${item.day}|${item.time}`;
        lessonMap[key] = {
            lesson: item.lesson,
            teacher: item.teacher_id || '',
            booked: item.booked_spots,
            total: item.total_spots,
            id: item.id
        };
    });

    // Создаём строки таблицы (слоты с 09:00 до 21:00)
    for (let hour = 9; hour <= 21; hour++) {
        const time = `${String(hour).padStart(2, '0')}:00`;
        const row = tbody.insertRow();
        const timeCell = row.insertCell();
        timeCell.className = 'time-col';
        timeCell.textContent = `${time} – ${String(hour + 1).padStart(2, '0')}:00`;

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
    }
}

// Функция для записи на занятие
async function updateBooking(day, time) {
    // 1. Ищем занятие по дню и времени
    const { data: scheduleData, error: findError } = await supabase
        .from('schedule')
        .select('id, booked_spots, total_spots')
        .eq('day', day)
        .eq('time', time)
        .single();

    if (findError || !scheduleData) {
        alert('❌ Занятие не найдено');
        return;
    }

    // 2. Проверяем, есть ли свободные места
    if (scheduleData.booked_spots >= scheduleData.total_spots) {
        alert('❌ Нет свободных мест');
        return;
    }

    // 3. Создаем запись в таблице bookings (нужна авторизация)
    const { error: bookingError } = await supabase
        .from('bookings')
        .insert({ schedule_id: scheduleData.id });

    if (bookingError) {
        console.error('Ошибка записи:', bookingError);
        alert('❌ Не удалось записаться. Возможно, вы уже записаны.');
        return;
    }

    // 4. Увеличиваем количество занятых мест
    const { error: updateError } = await supabase
        .from('schedule')
        .update({ booked_spots: scheduleData.booked_spots + 1 })
        .eq('id', scheduleData.id);

    if (updateError) {
        console.error('Ошибка обновления:', updateError);
        alert('❌ Ошибка при обновлении мест');
        return;
    }

    alert('✅ Вы успешно записаны!');
    loadSchedule(); // Обновляем таблицу
}

// Запускаем загрузку расписания при загрузке страницы
document.addEventListener('DOMContentLoaded', loadSchedule);
