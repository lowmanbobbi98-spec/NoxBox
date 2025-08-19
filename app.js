
// Simple offline-first planner.
// Data in localStorage: tasks[], habits[], habit_log[]; settings {theme}
// ---- Helpers ----
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const fmtDate = d => new Date(d).toISOString().slice(0,10);
const todayStr = () => fmtDate(new Date());
const parseDate = s => new Date(s+"T00:00:00");

function uid(prefix="id"){
  return prefix+"_"+Math.random().toString(36).slice(2,8);
}

function load(key, fallback){
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch(e){ return fallback; }
}
function save(key, val){ localStorage.setItem(key, JSON.stringify(val)); }

// ---- State ----
let tasks = load("tasks", []);
let habits = load("habits", []);
let habit_log = load("habit_log", []);
let settings = load("settings", { theme: "dark" });

// ---- Theme ----
function applyTheme(){
  if(settings.theme === "light"){
    document.body.classList.add("light");
  } else {
    document.body.classList.remove("light");
  }
  $("#darkModeToggle").checked = settings.theme === "dark";
}
$("#themeToggle").addEventListener("click", ()=>{
  settings.theme = (settings.theme === "dark") ? "light" : "dark";
  save("settings", settings); applyTheme();
});
$("#darkModeToggle").addEventListener("change", (e)=>{
  settings.theme = e.target.checked ? "dark" : "light";
  save("settings", settings); applyTheme();
});
applyTheme();

// ---- Tabs ----
function showTab(id){
  $$(".panel").forEach(p => p.classList.remove("active"));
  $$(".tab").forEach(t => t.classList.remove("tab-active"));
  document.getElementById(id).classList.add("active");
  document.querySelector(`.tab[data-tab='${id}']`).classList.add("tab-active");
  if(id==="calendar") renderCalendar();
  if(id==="habits") renderHabits();
  if(id==="tasks") renderTasks();
  if(id==="today") renderToday();
}
$$(".tab").forEach(btn => btn.addEventListener("click", ()=>showTab(btn.dataset.tab)));

// ---- Today tab ----
const quickDate = $("#quickDate");
quickDate.value = todayStr();

$("#quickAdd").addEventListener("click", ()=>{
  const title = $("#quickTitle").value.trim();
  if(!title) return;
  const due = $("#quickDate").value || todayStr();
  const t = { id: uid("t"), title, notes:"", due_date: due, is_done:false, created_at: new Date().toISOString() };
  tasks.unshift(t); save("tasks", tasks);
  $("#quickTitle").value = "";
  renderToday(); renderTasks(); renderCalendar();
});

$("#showDone").addEventListener("change", renderToday);

function renderToday(){
  const showDone = $("#showDone").checked;
  const today = todayStr();
  const list = $("#todayList"); list.innerHTML = "";
  const items = tasks.filter(t => (t.due_date <= today && (showDone || !t.is_done)));
  $("#emptyToday").style.display = items.length ? "none" : "block";
  for(const t of items){
    const li = document.createElement("li"); li.className = "item " + (t.is_done ? "done" : "");
    const left = document.createElement("div");
    const title = document.createElement("div"); title.className="title"; title.textContent = t.title;
    const sub = document.createElement("div"); sub.className="sub"; sub.textContent = `Due ${t.due_date}`;
    left.append(title, sub);
    const right = document.createElement("div");
    const btn = document.createElement("button"); btn.textContent = t.is_done ? "Undo" : "Done";
    btn.addEventListener("click", ()=>{ t.is_done = !t.is_done; save("tasks", tasks); renderToday(); renderTasks(); });
    right.append(btn);
    li.append(left, right); list.append(li);
  }
}
renderToday();

// ---- Tasks tab ----
let taskFilter = "all";
$("#search").addEventListener("input", renderTasks);
$$(".chip").forEach(ch => ch.addEventListener("click", ()=>{
  $$(".chip").forEach(c=>c.classList.remove("chip-active"));
  ch.classList.add("chip-active");
  taskFilter = ch.dataset.filter;
  renderTasks();
}));

function renderTasks(){
  const q = $("#search").value.toLowerCase().trim();
  let filtered = tasks.slice();
  const today = todayStr();
  if(taskFilter==="today") filtered = filtered.filter(t => t.due_date === today && !t.is_done);
  if(taskFilter==="overdue") filtered = filtered.filter(t => t.due_date < today && !t.is_done);
  if(taskFilter==="done") filtered = filtered.filter(t => t.is_done);
  if(q) filtered = filtered.filter(t => (t.title.toLowerCase().includes(q) || (t.notes||"").toLowerCase().includes(q)));
  const list = $("#taskList"); list.innerHTML = "";
  $("#emptyTasks").style.display = filtered.length ? "none" : "block";
  for(const t of filtered){
    const li = document.createElement("li"); li.className = "item " + (t.is_done ? "done" : "");
    const left = document.createElement("div");
    const title = document.createElement("div"); title.className="title"; title.textContent = t.title;
    const sub = document.createElement("div"); sub.className="sub"; sub.textContent = `Due ${t.due_date}`;
    left.append(title, sub);
    const right = document.createElement("div");
    const doneBtn = document.createElement("button"); doneBtn.textContent = t.is_done ? "Undo" : "Done";
    doneBtn.addEventListener("click", ()=>{ t.is_done = !t.is_done; save("tasks", tasks); renderTasks(); renderToday(); });
    const editBtn = document.createElement("button"); editBtn.className="secondary"; editBtn.textContent = "Edit";
    editBtn.addEventListener("click", ()=> editTask(t));
    right.append(doneBtn, editBtn);
    li.append(left, right); list.append(li);
  }
}

function editTask(t){
  const title = prompt("Task title:", t.title);
  if(title===null) return;
  const due = prompt("Due date (YYYY-MM-DD):", t.due_date);
  if(due===null) return;
  const notes = prompt("Notes:", t.notes||"") ?? t.notes;
  t.title = title.trim() || t.title;
  if(/^\d{4}-\d{2}-\d{2}$/.test(due)) t.due_date = due;
  t.notes = notes;
  save("tasks", tasks); renderTasks(); renderToday(); renderCalendar();
}

// ---- Calendar tab ----
let selected = new Date();
function monthMeta(d){
  const y = d.getFullYear(), m = d.getMonth();
  const first = new Date(y, m, 1);
  const last = new Date(y, m+1, 0);
  return { y, m, firstDow: first.getDay(), days: last.getDate() };
}
function renderCalendar(){
  const meta = monthMeta(selected);
  $("#monthLabel").textContent = new Date(meta.y, meta.m, 1).toLocaleString(undefined,{month:"long", year:"numeric"});
  const cells = $("#calCells"); cells.innerHTML = "";
  // leading blanks
  for(let i=0;i<meta.firstDow;i++){
    const div = document.createElement("div");
    cells.append(div);
  }
  for(let day=1; day<=meta.days; day++){
    const d = new Date(meta.y, meta.m, day);
    const div = document.createElement("div"); div.className="day";
    const label = document.createElement("div"); label.textContent = String(day);
    div.append(label);
    const dayStr = fmtDate(d);
    if(dayStr === todayStr()) div.classList.add("today");
    if(fmtDate(selected) === dayStr) div.classList.add("selected");
    const count = tasks.filter(t => t.due_date === dayStr && !t.is_done).length;
    if(count>0){ const b=document.createElement("span"); b.className="badge"; b.textContent=count; div.append(b); }
    div.addEventListener("click", ()=>{ selected = d; renderCalendar(); renderDayTasks(); });
    cells.append(div);
  }
  renderDayTasks();
}
function renderDayTasks(){
  const s = fmtDate(selected);
  $("#selectedDayLabel").textContent = new Date(s).toLocaleDateString(undefined,{weekday:"long", month:"short", day:"numeric"});
  const list = $("#dayTasks"); list.innerHTML = "";
  const items = tasks.filter(t => t.due_date === s);
  $("#emptyDay").style.display = items.length ? "none" : "block";
  for(const t of items){
    const li = document.createElement("li"); li.className="item " + (t.is_done ? "done": "");
    const left = document.createElement("div");
    const title = document.createElement("div"); title.className="title"; title.textContent=t.title;
    const sub = document.createElement("div"); sub.className="sub"; sub.textContent = t.notes || "";
    left.append(title, sub);
    const right = document.createElement("div");
    const doneBtn = document.createElement("button"); doneBtn.textContent = t.is_done ? "Undo" : "Done";
    doneBtn.addEventListener("click", ()=>{ t.is_done = !t.is_done; save("tasks", tasks); renderCalendar(); renderDayTasks(); renderToday(); renderTasks(); });
    right.append(doneBtn);
    li.append(left, right); list.append(li);
  }
}
$("#prevMonth").addEventListener("click", ()=>{ selected = new Date(selected.getFullYear(), selected.getMonth()-1, 1); renderCalendar(); });
$("#nextMonth").addEventListener("click", ()=>{ selected = new Date(selected.getFullYear(), selected.getMonth()+1, 1); renderCalendar(); });

// ---- Habits ----
$("#addHabit").addEventListener("click", ()=>{
  const name = $("#habitName").value.trim();
  if(!name) return;
  habits.unshift({ id: uid("h"), name, streak:0, last_checked:null });
  save("habits", habits); $("#habitName").value = ""; renderHabits();
});

function weekStart(d=new Date()){ const n=new Date(d); n.setDate(n.getDate()-n.getDay()); return n; } // Sunday
function dateAdd(base, days){ const d=new Date(base); d.setDate(d.getDate()+days); return d; }

function renderHabits(){
  const cont = $("#habitsContainer"); cont.innerHTML = "";
  if(habits.length===0){ cont.innerHTML = '<p class="muted">No habits yet—add one.</p>'; return; }
  const ws = weekStart();
  for(const h of habits){
    const card = document.createElement("div"); card.className = "card";
    const row = document.createElement("div"); row.className="row space";
    const left = document.createElement("div"); left.innerHTML = `<strong>${h.name}</strong> <span class="badge">Streak: ${h.streak}</span>`;
    const right = document.createElement("div");
    const del = document.createElement("button"); del.className="secondary"; del.textContent="Delete";
    del.addEventListener("click", ()=>{ if(confirm("Delete habit?")){ habits = habits.filter(x=>x.id!==h.id); habit_log = habit_log.filter(x=>x.habit_id!==h.id); save("habits", habits); save("habit_log", habit_log); renderHabits(); } });
    right.append(del);
    row.append(left, right); card.append(row);

    const daysRow = document.createElement("div"); daysRow.className="row";
    for(let i=0;i<7;i++){
      const d = dateAdd(ws, i); const ds = fmtDate(d);
      const rec = habit_log.find(x=>x.habit_id===h.id && x.date===ds);
      const btn = document.createElement("button");
      btn.className = rec && rec.done ? "" : "secondary";
      btn.textContent = ["S","M","T","W","T","F","S"][i];
      btn.addEventListener("click", ()=>{
        const existing = habit_log.find(x=>x.habit_id===h.id && x.date===ds);
        if(existing){ existing.done = !existing.done; } else { habit_log.push({habit_id:h.id, date:ds, done:true}); }
        // Recompute streak ending today
        let streak=0; let cur=new Date();
        while(true){
          const ds2 = fmtDate(cur);
          const log = habit_log.find(x=>x.habit_id===h.id && x.date===ds2);
          if(log && log.done){ streak++; cur.setDate(cur.getDate()-1); } else break;
        }
        h.streak = streak; h.last_checked = streak>0 ? todayStr(): null;
        save("habit_log", habit_log); save("habits", habits); renderHabits();
      });
      daysRow.append(btn);
    }
    card.append(daysRow);
    cont.append(card);
  }
}

// ---- Settings: Export/Import ----
$("#exportData").addEventListener("click", ()=>{
  const payload = { tasks, habits, habit_log, settings, exported_at: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(payload,null,2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "bluenox_planner_backup.json"; a.click();
  URL.revokeObjectURL(url);
});
$("#importBtn").addEventListener("click", ()=>{
  const f = $("#importFile").files[0];
  if(!f) return alert("Choose a JSON backup file first.");
  const r = new FileReader();
  r.onload = ()=>{
    try{
      const data = JSON.parse(r.result);
      tasks = data.tasks||[]; habits = data.habits||[]; habit_log = data.habit_log||[]; settings = data.settings||settings;
      save("tasks", tasks); save("habits", habits); save("habit_log", habit_log); save("settings", settings);
      applyTheme(); renderToday(); renderTasks(); renderCalendar(); renderHabits();
      alert("Import complete.");
    }catch(e){ alert("Invalid JSON file."); }
  };
  r.readAsText(f);
});

// ---- PWA install ----
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('service-worker.js');
  });
}
