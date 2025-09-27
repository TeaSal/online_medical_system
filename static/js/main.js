// main.js - full frontend orchestration for MedPortal
document.addEventListener("DOMContentLoaded", () => {

  /* ----------------------
     Utilities: toast, local storage keys, fallbacks
     ---------------------- */
  const KEY_USER = "med_user";
  const KEY_APPTS = "med_appts";

  function toast(msg, err = false) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.remove("d-none");
    t.style.background = err ? "rgba(239,68,68,0.08)" : "rgba(16,185,129,0.08)";
    t.style.color = err ? "#991b1b" : "#047857";
    setTimeout(() => t.classList.add("d-none"), 2400);
  }

  function saveUser(u) { localStorage.setItem(KEY_USER, JSON.stringify(u)); }
  function getUser() { try { return JSON.parse(localStorage.getItem(KEY_USER)); } catch(e){ return null; } }
  function logout() { localStorage.removeItem(KEY_USER); renderTopNav(); }

  function saveAppts(a) { localStorage.setItem(KEY_APPTS, JSON.stringify(a)); }
  function getAppts() { try { return JSON.parse(localStorage.getItem(KEY_APPTS)) || []; } catch(e){ return []; } }

  function apiPost(path, body) {
    // Helper: POST JSON to backend if present (returns Promise)
    return fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(r => r.ok ? r.json() : Promise.reject(r));
  }

  // fallback doctors list (used if /doctors endpoint not available)
  function fallbackDoctors(){
    return [
      { id: 1, name: "Dr. Olivia Turner, M.D.", department: "Dermato-Endocrinology", experience: 15, bio: "Focus: endocrine-related skin conditions."},
      { id: 2, name: "Dr. Alexander Bennett, Ph.D.", department: "Dermato-Genetics", experience: 12, bio: "Focus: genetic skin disorders."},
      { id: 3, name: "Dr. Sophia Martinez, Ph.D.", department: "Cosmetic Bioengineering", experience: 8, bio: "Focus: cosmetic dermatology."},
      { id: 4, name: "Dr. Michael Davidson, M.D.", department: "Nano-Dermatology", experience: 10, bio: "Research-focused dermatologist."}
    ];
  }

  /* ----------------------
     Top nav rendering (login/logout buttons)
     ---------------------- */
  function renderTopNav() {
    const user = getUser();
    const navLogin = document.getElementById("navLogin");
    const navSignup = document.getElementById("navSignup");
    const loggedInActions = document.getElementById("loggedInActions");
    const topUserSmall = document.getElementById("topUserSmall");
    if (user) {
      if (navLogin) navLogin.classList.add("d-none");
      if (navSignup) navSignup.classList.add("d-none");
      if (loggedInActions) loggedInActions.classList.remove("d-none");
      if (topUserSmall) topUserSmall.textContent = `Hi, ${user.name || user.email || "User"}`;
    } else {
      if (navLogin) navLogin.classList.remove("d-none");
      if (navSignup) navSignup.classList.remove("d-none");
      if (loggedInActions) loggedInActions.classList.add("d-none");
      if (topUserSmall) topUserSmall.textContent = `Welcome`;
    }
  }
  renderTopNav();

  // Logout hook
  const btnLogout = document.getElementById("btnLogout");
  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      logout();
      toast("Signed out", false);
      setTimeout(() => { location.href = "/login"; }, 500);
    });
  }

  /* ----------------------
     Login page behavior
     ---------------------- */
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    document.getElementById("toggleLoginPw")?.addEventListener("click", (e) => {
      const pw = document.getElementById("loginPassword");
      if (pw.type === "password") { pw.type = "text"; } else { pw.type = "password"; }
    });

    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = document.getElementById("loginEmail").value.trim();
      const password = document.getElementById("loginPassword").value.trim();
      if (!email || !password) { toast("Please enter email & password", true); return; }

      // Try backend login first
      apiPost("/api/login", { email, password })
      .then(data => {
        // expected: { token: "...", user: { name, email } }
        saveUser(data.user || { name: data.name || email, email });
        toast("Logged in");
        renderTopNav();
        setTimeout(() => location.href = "/dashboard", 400);
      })
      .catch(_ => {
        // fallback: local login (for demo)
        // If a local signup exists we accept it, else create simulated session
        const existing = getUser();
        if (existing && existing.email === email) {
          toast("Logged in (local)");
          renderTopNav();
          setTimeout(() => location.href = "/dashboard", 300);
          return;
        }
        // create a light local session
        saveUser({ name: email.split("@")[0], email });
        toast("Logged in (local)");
        renderTopNav();
        setTimeout(() => location.href = "/dashboard", 400);
      });
    });
  }

  /* ----------------------
     Signup page behavior
     ---------------------- */
  const signupForm = document.getElementById("signupForm");
  if (signupForm) {
    const pw = document.getElementById("signupPassword");
    const meter = document.querySelector(".pw-meter > i");
    if (pw && meter) {
      pw.addEventListener("input", () => {
        const val = pw.value;
        let score = 0;
        if (val.length >= 6) score++;
        if (/[A-Z]/.test(val)) score++;
        if (/[0-9]/.test(val)) score++;
        if (/[^A-Za-z0-9]/.test(val)) score++;
        meter.style.width = (score/4*100) + "%";
        meter.style.background = score <= 1 ? "#ff6b6b" : score === 2 ? "#f59e0b" : "#10b981";
      });
    }

    signupForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("signupName").value.trim();
      const dob = document.getElementById("signupDob").value;
      const contact = document.getElementById("signupContact").value.trim();
      const email = document.getElementById("signupEmail").value.trim();
      const password = document.getElementById("signupPassword").value;
      const confirm = document.getElementById("signupConfirmPassword").value;
      if (!name || !dob || !email || !password || !confirm) { toast("Please fill all required fields", true); return; }
      if (password !== confirm) { toast("Passwords do not match", true); return; }

      // Try backend signup
      apiPost("/api/signup", { name, dob, contact, email, password })
        .then(data => {
          saveUser(data.user || { name, email });
          toast("Account created");
          renderTopNav();
          setTimeout(() => location.href = "/dashboard", 400);
        })
        .catch(_ => {
          // fallback: save locally
          saveUser({ name, dob, contact, email });
          toast("Account created (local)");
          renderTopNav();
          setTimeout(() => location.href = "/dashboard", 400);
        });
    });
  }

  /* ----------------------
     Doctors: load & render (used by doctors page and dashboard preview)
     ---------------------- */
  function fetchDoctors() {
    return fetch("/doctors")
      .then(r => r.ok ? r.json() : Promise.reject())
      .catch(_ => fallbackDoctors());
  }

  // Render doctors list on /doctors page
  if (document.getElementById("doctorsList")) {
    fetchDoctors().then(docs => {
      const list = document.getElementById("doctorsList");
      list.innerHTML = docs.map(d => `
        <div class="col-12 col-md-6 col-lg-4">
          <div class="doctor-card p-3 h-100">
            <img src="https://randomuser.me/api/portraits/med/men/${d.id * 7 % 90}.jpg" width="72" height="72" alt="doc">
            <div style="flex:1">
              <div class="d-flex justify-content-between">
                <div>
                  <h6 class="mb-1 fw-bold">${d.name}</h6>
                  <div class="muted small">${d.department}</div>
                </div>
                <div class="text-end">
                  <div class="small muted">${d.experience} yrs</div>
                  <a href="/doctor/${d.id}" class="btn btn-sm btn-primary mt-2">Info</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      `).join("");
    });
  }

  // Dashboard doctors preview & dates
  if (document.getElementById("doctorsPreview")) {
    fetchDoctors().then(docs => {
      const preview = document.getElementById("doctorsPreview");
      preview.innerHTML = docs.slice(0,4).map(d => `
        <div class="col-12 col-md-6">
          <div class="doctor-card p-3">
            <img src="https://randomuser.me/api/portraits/med/women/${d.id * 11 % 90}.jpg" width="64" height="64">
            <div style="flex:1">
              <h6 class="mb-0 fw-bold">${d.name}</h6>
              <small class="muted">${d.department}</small>
              <div class="mt-2">
                <a href="/doctor/${d.id}" class="btn btn-sm btn-outline-primary">View</a>
              </div>
            </div>
          </div>
        </div>
      `).join("");
    });

    // render next 7 day pills
    const datesRow = document.getElementById("datesRow");
    const today = new Date();
    datesRow.innerHTML = [...Array(7)].map((_,i) => {
      const d = new Date(); d.setDate(today.getDate() + i);
      const dd = d.getDate();
      const day = d.toLocaleDateString(undefined, { weekday: "short" });
      return `<div class="date-pill text-center"><div class="small muted">${day}</div><div class="fw-bold">${dd}</div></div>`;
    }).join("");
  }

  /* ----------------------
     Doctor detail page (view & schedule button)
     ---------------------- */
  if (document.getElementById("docFullName") || document.getElementById("btnSchedule") || document.getElementById("docFullName")) {
    // We put safe checks in case template doesn't have those IDs.
  }
  if (document.querySelector("#docFullName") || document.querySelector("#docShortBio")) {
    // older template might use different ids; still safe
  }

  // Populate doctor_detail fields
  if (document.querySelector("#docFullName") || document.querySelector("#docAvatar")) {
    (function renderDoctorDetail(){
      const path = location.pathname; // /doctor/2
      const id = parseInt(path.split("/").filter(Boolean).pop()) || 0;
      const back = document.getElementById("backToDoctors");
      if (back) back.href = "/doctors";

      fetchDoctors().then(list => {
        const d = list.find(x=>x.id===id) || fallbackDoctors()[0];
        document.getElementById("docFullName").textContent = d.name;
        document.getElementById("docDept").textContent = d.department;
        document.getElementById("docExp").textContent = `${d.experience} yrs`;
        document.getElementById("docShortBio").textContent = d.bio;
        document.getElementById("docProfile").textContent = d.bio + " " + "Professional highlights and career path.";
        const img = document.getElementById("docAvatar");
        if (img) img.src = `https://randomuser.me/api/portraits/men/${d.id * 13 % 90}.jpg`;
        const btn = document.getElementById("btnSchedule");
        if (btn) { btn.href = `/doctor/${d.id}/schedule`; }
      }).catch(_=>{
        // fallback
      });
    })();
  }

  /* ----------------------
     Schedule page (select date/time and patient info)
     ---------------------- */
  if (document.getElementById("confirmSched") || document.getElementById("schedTimeSlots")) {
    (function initSchedule(){
      const pathParts = location.pathname.split("/").filter(Boolean); // ['doctor','2','schedule']
      const doctorId = pathParts.length >= 2 ? parseInt(pathParts[1]) : 0;
      const back = document.getElementById("backToDoc");
      if (back) back.href = `/doctor/${doctorId}`;

      // fill doctor header
      fetchDoctors().then(list => {
        const d = list.find(x => x.id === doctorId) || fallbackDoctors()[0];
        document.getElementById("scheduleHeader").textContent = `Schedule — ${d.name}`;
      });

      // create date pills (7 days)
      const datePills = document.getElementById("schedDatePills");
      const today = new Date();
      datePills.innerHTML = [...Array(7)].map((_,i) => {
        const dd = new Date(); dd.setDate(today.getDate()+i);
        const short = dd.toLocaleDateString(undefined,{weekday:"short"});
        const day = dd.getDate();
        return `<button class="date-pill btn btn-sm" data-date="${dd.toISOString().slice(0,10)}">${short}<br><strong>${day}</strong></button>`;
      }).join("");

      // time slots (static for demo)
      const times = ["09:00 AM","09:30 AM","10:00 AM","11:00 AM","11:30 AM","02:00 PM","02:30 PM","03:00 PM"];
      const slots = document.getElementById("schedTimeSlots");
      slots.innerHTML = times.map(t => `<button class="slot btn btn-outline-primary btn-sm">${t}</button>`).join("");

      // selection logic
      let chosenDate = null, chosenTime = null;
      datePills.querySelectorAll ? datePills.querySelectorAll(".date-pill")?.forEach(btn => {
        btn.addEventListener("click", e => {
          datePills.querySelectorAll(".date-pill").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          chosenDate = btn.getAttribute("data-date");
        });
      }) : null;

      slots.querySelectorAll(".slot")?.forEach(b => {
        b.addEventListener("click", () => {
          slots.querySelectorAll(".slot").forEach(x => x.classList.remove("active"));
          b.classList.add("active");
          chosenTime = b.textContent.trim();
        });
      });

      // prefill patient fields if user is logged in
      const user = getUser();
      if (user && document.getElementById("patientName")) document.getElementById("patientName").value = user.name || user.email || "";

      // toggle patient fields when "Another person" selected
      document.getElementById("pfOther")?.addEventListener("change", () => {
        document.getElementById("patientName").value = "";
        document.getElementById("patientAge").value = "";
      });

      document.getElementById("confirmSched").addEventListener("click", () => {
        const name = document.getElementById("patientName").value.trim() || (user ? (user.name || user.email) : "Guest");
        const age = document.getElementById("patientAge").value || "";
        const gender = document.getElementById("patientGender").value || "";
        const notes = document.getElementById("patientProblem").value || "";

        if (!chosenDate || !chosenTime) { toast("Choose date and time", true); return; }

        // build appointment
        fetchDoctors().then(list => {
          const doc = list.find(x=>x.id===doctorId) || fallbackDoctors()[0];
          const appt = {
            id: Date.now(),
            doctorId: doctorId,
            doctorName: doc.name,
            date: chosenDate,
            time: chosenTime,
            patientName: name,
            age,
            gender,
            notes,
            status: "Upcoming"
          };

          // try backend
          apiPost("/appointments", {
            doctor_id: doctorId,
            patient_name: name,
            start_datetime: `${chosenDate}T${formatTime24(chosenTime)}`
          }).then(res => {
            // if backend returns something, we still save local copy for UI
            const arr = getAppts();
            arr.push(appt);
            saveAppts(arr);
            toast("Booked (backend)");
            setTimeout(()=> location.href = "/appointments", 700);
          }).catch(_ => {
            // fallback local save
            const arr = getAppts();
            arr.push(appt);
            saveAppts(arr);
            toast("Appointment booked");
            setTimeout(()=> location.href = "/appointments", 600);
          });
        });
      });

      function formatTime24(t) {
        // converts "02:30 PM" => "14:30:00"
        const [time, ampm] = t.split(" ");
        let [h,m] = time.split(":").map(Number);
        if (ampm === "PM" && h < 12) h += 12;
        if (ampm === "AM" && h === 12) h = 0;
        return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`;
      }
    })();
  }

  /* ----------------------
     Appointments page (tabs + list + cancel/rebook)
     ---------------------- */
  if (document.getElementById("apptsContainer") || document.getElementById("apptsContainer")) {
    (function apptsPage(){
      const container = document.getElementById("apptsContainer") || document.getElementById("apptsContainer");
      const tabs = document.querySelectorAll("#apptTabs button");
      let active = "upcoming";
      tabs.forEach(btn => {
        btn.addEventListener("click", () => {
          tabs.forEach(t => t.classList.remove("active"));
          btn.classList.add("active");
          active = btn.getAttribute("data-tab");
          render();
        });
      });

      function render() {
        const arr = getAppts().slice().sort((a,b) => (a.date + " " + a.time) > (b.date + " " + b.time) ? 1 : -1);
        let filtered;
        if (active === "upcoming") filtered = arr.filter(a => a.status === "Upcoming" || a.status === "Scheduled");
        else if (active === "completed") filtered = arr.filter(a => a.status === "Completed");
        else filtered = arr.filter(a => a.status === "Cancelled");

        if (!filtered.length) { container.innerHTML = `<div class="muted">No ${active} appointments.</div>`; return; }

        // map to html
        container.innerHTML = filtered.map(a => `
          <div class="card-custom p-3 mb-3">
            <div class="d-flex justify-content-between">
              <div>
                <div class="fw-bold">${a.doctorName || 'Doctor #' + a.doctorId}</div>
                <div class="muted small">${a.date} • ${a.time}</div>
                <div class="small muted">${a.patientName || ""} ${a.age ? " • "+a.age+" yrs" : ""}</div>
                <div class="mt-2 small">${a.notes || ""}</div>
              </div>
              <div class="text-end">
                <span class="badge ${a.status === 'Upcoming' ? 'bg-primary' : a.status === 'Completed' ? 'bg-success' : 'bg-secondary'}">${a.status}</span>
                <div class="mt-2">
                  <button class="btn btn-sm btn-outline-primary rebook" data-doc="${a.doctorId}">Re-Book</button>
                  <button class="btn btn-sm btn-outline-danger ms-2 cancel" data-id="${a.id}">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        `).join("");

        // attach handlers
        document.querySelectorAll(".cancel").forEach(b => b.addEventListener("click", e => {
          const id = parseInt(e.target.getAttribute("data-id"));
          let appts = getAppts();
          appts = appts.map(a => a.id === id ? {...a, status: "Cancelled"} : a);
          saveAppts(appts);
          toast("Appointment cancelled");
          render();
        }));

        document.querySelectorAll(".rebook").forEach(b => b.addEventListener("click", e => {
          const doc = parseInt(e.target.getAttribute("data-doc"));
          location.href = `/doctor/${doc}/schedule`;
        }));
      }

      render();
    })();
  }

  /* ----------------------
     Dashboard page: show next appointment & small profile summary
     ---------------------- */
  if (document.getElementById("nextAppt") || document.getElementById("dashUserName")) {
    (function dashInit(){
      const user = getUser();
      if (user) {
        const nameEl = document.getElementById("dashUserName");
        if (nameEl) nameEl.textContent = user.name || user.email;
      }
      // next appointment
      const appts = getAppts().filter(a => a.status === "Upcoming" || a.status === "Scheduled");
      const nextEl = document.getElementById("nextAppt");
      if (nextEl) {
        if (!appts.length) {
          nextEl.innerHTML = `<div class="muted">No upcoming appointments — book one now.</div>`;
        } else {
          appts.sort((a,b) => (a.date + " " + a.time) > (b.date + " " + b.time) ? 1 : -1);
          const n = appts[0];
          nextEl.innerHTML = `
            <div class="appt-card d-flex justify-content-between align-items-center">
              <div>
                <div class="small muted">Next appointment</div>
                <div class="fw-bold">${n.doctorName}</div>
                <div class="muted small">${n.date} • ${n.time}</div>
              </div>
              <div><a href="/appointments" class="btn btn-sm btn-outline-primary">View</a></div>
            </div>
          `;
        }
      }
    })();
  }

  /* ----------------------
     Profile page: load/save local profile
     ---------------------- */
  if (document.getElementById("profileForm")) {
    const user = getUser() || {};
    document.getElementById("profileName").value = user.name || "";
    document.getElementById("profileDob").value = user.dob || "";
    document.getElementById("profileContact").value = user.contact || "";
    document.getElementById("profileEmail").value = user.email || "";

    document.getElementById("profileForm").addEventListener("submit", (e)=>{
      e.preventDefault();
      const updated = {
        name: document.getElementById("profileName").value.trim(),
        dob: document.getElementById("profileDob").value,
        contact: document.getElementById("profileContact").value,
        email: document.getElementById("profileEmail").value
      };
      saveUser(updated);
      toast("Profile saved");
      renderTopNav();
    });
  }

  /* ----------------------
     Confirm page (after booking)
     ---------------------- */
  if (document.getElementById("confirmDetails")) {
    const id = parseInt(location.pathname.split("/").pop());
    const appts = getAppts();
    const a = appts.find(x=>x.id===id);
    const el = document.getElementById("confirmDetails");
    const go = document.getElementById("goAppts");
    if (a) {
      el.innerHTML = `<div class="fw-bold">${a.doctorName}</div><div class="muted">${a.date} • ${a.time}</div><div class="mt-2">${a.patientName || ""}</div>`;
      go.href = "/appointments";
    } else {
      el.innerHTML = `<div class="muted">No details found.</div>`;
      go.href = "/appointments";
    }
  }

  /* ----------------------
     Utilities: highlight bottom nav and small active link
     ---------------------- */
  function setActiveNav() {
    const map = {
      "/dashboard": "bn-home",
      "/doctors": "bn-doctors",
      "/appointments": "bn-appointments",
      "/profile": "bn-profile"
    };
    const path = location.pathname.split("/").filter(Boolean)[0] ? "/" + location.pathname.split("/").filter(Boolean)[0] : "/dashboard";
    // highlight bottom nav
    Object.values(map).forEach(id => document.getElementById(id)?.classList.remove("active"));
    const el = document.getElementById(map[path]);
    if (el) el.classList.add("active");
  }
  setActiveNav();

  // Render top nav at end
  renderTopNav();

}); // DOMContentLoaded
