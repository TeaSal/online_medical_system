document.addEventListener("DOMContentLoaded", () => {
  // small toast
  const toastEl = document.createElement("div");
  toastEl.id = "appToast"; toastEl.className = "app-toast"; document.body.appendChild(toastEl);
  function toast(msg, show=true){ const t = document.getElementById("appToast"); t.textContent = msg; t.style.display = show ? "block" : "none"; setTimeout(()=>t.style.display="none",2000); }

  // helper api
  async function api(path, opts){
    const res = await fetch(path, opts);
    if (!res.ok) {
      const text = await res.text().catch(()=>null);
      throw { status: res.status, body: text || "" };
    }
    return res.json();
  }

  // get current user from server session
  async function loadMe(){
    try { const r = await api("/api/me"); return r.user; }
    catch { return null; }
  }

  // FAVORITE DOCTOR (on doctor detail page)
  const favBtn = document.getElementById("btnFav");
  if (favBtn) {
    const path = location.pathname.split("/").filter(Boolean);
    const docId = parseInt(path[1]); // /doctor/<id>
    // Load current favs
    fetch(`/api/favorites`)
      .then(res => res.json())
      .then(favs => {
        if (favs.some(f => f.doctor_id === docId)) {
          favBtn.textContent = "★ Favorited";
          favBtn.classList.remove("btn-outline-primary");
          favBtn.classList.add("btn-warning");
        } else {
          favBtn.textContent = "♡ Favorite";
          favBtn.classList.add("btn-outline-primary");
          favBtn.classList.remove("btn-warning");
        }
      });
    // Toggle on click
    favBtn.addEventListener("click", () => {
      if (favBtn.textContent.includes("Favorited")) {
        fetch(`/api/favorites/${docId}`, { method: "DELETE" })
          .then(res => res.json())
          .then(() => {
            favBtn.textContent = "♡ Favorite";
            favBtn.classList.add("btn-outline-primary");
            favBtn.classList.remove("btn-warning");
            toast("Removed from favorites");
          });
      } else {
        fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ doctor_id: docId })
        })
          .then(res => res.json())
          .then(() => {
            favBtn.textContent = "★ Favorited";
            favBtn.classList.remove("btn-outline-primary");
            favBtn.classList.add("btn-warning");
            toast("Added to favorites");
          });
      }
    });
  }

  // DASHBOARD FAVORITES
  const favDoctorsDiv = document.getElementById("favDoctors");
  if (favDoctorsDiv) {
    fetch(`/api/favorites`)
      .then(res => res.json())
      .then(favs => {
        favDoctorsDiv.innerHTML = favs.length ? favs.map(f => `
          <div class="col-md-4">
            <div class="card p-3">
              <img src="${f.photo_url || 'https://via.placeholder.com/100'}" class="rounded-circle mb-2" width="80">
              <h5>${f.doctor_name}</h5>
              <p class="muted">${f.department}</p>
              <a href="/doctor/${f.doctor_id}" class="btn btn-sm btn-outline-secondary">View</a>
            </div>
          </div>
        `).join("") : `<div class="muted">No favorites yet</div>`;
      });
  }

  // LOGIN page
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("loginEmail").value.trim();
      const password = document.getElementById("loginPassword").value.trim();
      if (!email || !password) { toast("fill both"); return; }
      try {
        await api("/api/login", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ email, password })});
        toast("Logged in");
        setTimeout(()=>location.href="/dashboard",300);
      } catch(err) { toast("Login failed"); console.error(err); }
    });
  }

  // SIGNUP page
  const signupForm = document.getElementById("signupForm");
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("signupName").value.trim();
      const dob = document.getElementById("signupDob").value;
      const contact = document.getElementById("signupContact").value.trim();
      const email = document.getElementById("signupEmail").value.trim();
      const password = document.getElementById("signupPassword").value;
      if (!name || !email || !password) { toast("missing fields"); return; }
      try {
        await api("/api/signup", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ name, dob, contact, email, password })});
        toast("Account created");
        setTimeout(()=>location.href="/dashboard",400);
      } catch(err){ toast("Signup failed"); console.error(err); }
    });
  }

  // NAV: logout form handle (if present)
  const logoutForm = document.getElementById("logoutForm");
  if (logoutForm) {
    logoutForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      await fetch("/api/logout", { method:"POST" });
      toast("Signed out");
      setTimeout(()=>location.href="/",200);
    });
  }

  // Doctors list page - use d.photo_url to avoid random images
  const doctorsListEl = document.getElementById("doctorsList");
  if (doctorsListEl) {
    fetch("/api/doctors").then(r=>r.json()).then(docs => {
      doctorsListEl.innerHTML = docs.map(d => `
        <div class="col-12 col-md-6 col-lg-4">
          <div class="doctor-card">
            <img src="${d.photo_url || 'https://via.placeholder.com/100'}" width="64" height="64" style="border-radius:50%">
            <div style="flex:1">
              <div class="d-flex justify-content-between">
                <div><h6 class="mb-0 fw-bold">${d.name}</h6><small class="muted">${d.department}</small></div>
                <div class="text-end"><div class="small muted">${d.experience} yrs</div><a href="/doctor/${d.id}" class="btn btn-sm btn-primary mt-2">Info</a></div>
              </div>
            </div>
          </div>
        </div>
      `).join("");
    }).catch(()=>{ doctorsListEl.innerHTML = "<div class='muted'>Unable to load doctors</div>"; });
  }

  // Doctor detail page
  if (document.getElementById("docFullName")) {
    const parts = location.pathname.split("/").filter(Boolean);
    const docId = parseInt(parts[1]);
    const backTo = document.getElementById("backToDoc") || document.getElementById("backToDoctors");
    if (backTo) backTo.href = "/doctors";
    fetch(`/api/doctors/${docId}`).then(r=>r.json()).then(d=>{
      document.getElementById("docFullName").textContent = d.name;
      document.getElementById("docDept").textContent = d.department;
      document.getElementById("docExp").textContent = `${d.experience} yrs`;
      document.getElementById("docShortBio").textContent = d.bio || "";
      document.getElementById("docProfile").textContent = d.bio || "";
      const btn = document.getElementById("btnSchedule");
      if (btn) btn.href = `/doctor/${d.id}/schedule`;
      const avatar = document.getElementById("docAvatar");
      if (avatar && d.photo_url) avatar.src = d.photo_url;
    }).catch(err=>{ console.error(err); });
  }

  // Book (schedule) page - uses flatpickr for date selection + time slot selection for time
  if (document.getElementById("confirmSched") || document.getElementById("schedTimeSlots")) {
    (function(){
      const parts = location.pathname.split("/").filter(Boolean);
      const docId = parseInt(parts[1]);
      const backTo = document.getElementById("backToDoc");
      if (backTo) backTo.href = `/doctor/${docId}`;

      // insert a datepicker input (schedule.html includes #appointmentDate)
      let chosenDate = null, chosenTime = null;
      // initialize flatpickr (if available)
      if (window.flatpickr) {
        flatpickr("#appointmentDate", {
          minDate: "today",
          dateFormat: "Y-m-d",
          onChange: function(selectedDates) {
            
            if (selectedDates && selectedDates.length) {
              const d = selectedDates[0];
              chosenDate = d.toISOString().slice(0,10);
            }
          }
        });
      } else {
        // fallback: use today's date default
        const d = new Date(); chosenDate = d.toISOString().slice(0,10);
      }

      // time slots (same as before)
      const times = ["09:00 AM","09:30 AM","10:00 AM","11:00 AM","11:30 AM","02:00 PM","02:30 PM","03:00 PM"];
      const slotsEl = document.getElementById("schedTimeSlots");
      slotsEl.innerHTML = times.map(t => `<button class="slot btn btn-outline-primary btn-sm">${t}</button>`).join("");

      const dateInput = document.getElementById("appointmentDate");
      // if user picks date by typing or default value, update chosenDate
      if (dateInput) {
        dateInput.addEventListener("change", () => {
          if (dateInput.value) chosenDate = dateInput.value;
        });
      }

      slotsEl.querySelectorAll(".slot").forEach(s => s.addEventListener("click", ()=> {
        slotsEl.querySelectorAll(".slot").forEach(x=>x.classList.remove("active"));
        s.classList.add("active"); chosenTime = s.textContent.trim();
      }));

      document.getElementById("confirmSched").addEventListener("click", async ()=> {
        const user = await loadMe();
        if (!user) { toast("Please log in to book"); setTimeout(()=>location.href="/login",300); return; }
        if (!chosenDate || !chosenTime) { toast("Choose date & time"); return; }
        const patientName = document.getElementById("patientName").value.trim() || user.name || user.email;
        const notes = document.getElementById("patientProblem").value.trim();
        const patientAge = document.getElementById("patientAge").value.trim();

        // convert chosenDate + chosenTime to ISO
        function toISO(dateStr, timeStr){
          let [time, ampm] = [timeStr.split(" ")[0], timeStr.split(" ")[1]];
          let [hh, mm] = time.split(":").map(Number);
          if (ampm === "PM" && hh < 12) hh += 12;
          if (ampm === "AM" && hh === 12) hh = 0;
          const s = `${dateStr}T${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}:00`;
          return s;
        }

        const start_iso = toISO(chosenDate, chosenTime);
        try {
  const res = await api("/api/appointments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      doctor_id: docId,
      start_datetime: start_iso,
      notes
    })
  });

  if (res.id || res.bill_id) {
    toast("Appointment booked successfully!");
    setTimeout(() => location.href = `/confirm/${res.id}`, 500);
  } else if (res.error) {
    toast("Error: " + res.error);
  } else {
    toast("Booking failed — please try again.");
  }

} catch (err) {
  if (err.status === 409) toast("Time clash — pick another slot");
  else toast("Time clash — pick another slot");
  console.error("Error while booking:", err);
}

      });
    })();
  }

  // Confirm page
  if (document.getElementById("confirmDetails")) {
    (async ()=> {
      const parts = location.pathname.split("/").filter(Boolean);
      const apptId = parseInt(parts[1]);
      try {
        const ap = await api(`/api/appointments/${apptId}`);
        const doc = await api(`/api/doctors/${ap.doctor_id}`);
        const el = document.getElementById("confirmDetails");
        el.innerHTML = `<div class="fw-bold">${doc.name}</div><div class="muted">${new Date(ap.start_datetime).toLocaleString()}</div><div class="mt-2">${ap.notes||""}</div>`;
      } catch(e){ document.getElementById("confirmDetails").innerHTML = "<div class='muted'>No details found</div>"; }
    })();
  }

  // Appointments page (tabs)
  if (document.getElementById("apptsContainer")) {
    (async ()=> {
      const tabs = document.querySelectorAll("#apptTabs button");
      let active = "upcoming";
      tabs.forEach(b => b.addEventListener("click", ()=> { tabs.forEach(x=>x.classList.remove("active")); b.classList.add("active"); active = b.dataset.tab; render(); }));
      async function render(){
        const appts = await api("/api/appointments?mine=1");
        let filtered = appts;
        if (active === "upcoming") filtered = appts.filter(a => a.status === "scheduled");
        if (active === "completed") filtered = appts.filter(a => a.status === "completed");
        if (active === "cancelled") filtered = appts.filter(a => a.status === "canceled");
        const container = document.getElementById("apptsContainer");
        if (!filtered.length){ container.innerHTML = `<div class="muted">No ${active} appointments.</div>`; return; }
        container.innerHTML = filtered.map(a => `
          <div class="card p-3 mb-3">
            <div class="d-flex justify-content-between">
              <div>
                <div class="fw-bold">${a.doctor_name || "Doctor #" + a.doctor_id}</div>
                <div class="muted small">${new Date(a.start_datetime).toLocaleString()}</div>
                <div class="small muted">${a.reason||""}</div>
              </div>
              <div class="text-end">
                <span class="badge ${a.status==='scheduled'?'bg-primary':a.status==='completed'?'bg-success':'bg-secondary'}">${a.status}</span>
                <div class="mt-2">
                  <button class="btn btn-sm btn-outline-danger ms-2 cancel" data-id="${a.id}">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        `).join("");
        container.querySelectorAll(".cancel").forEach(btn=>btn.addEventListener("click", async (e)=>{
          const id = e.target.dataset.id;
          try { await api(`/api/appointments/${id}`, { method:"DELETE" }); toast("Canceled"); render(); } catch(e){ toast("Failed"); }
        }));
      }
      render();
    })();
  }

  // Dashboard small components: load name, next appt, doctor preview, dates
  if (document.getElementById("dashUserName") || document.getElementById("doctorsPreview")) {
    (async ()=> {
      const me = await loadMe();
      if (me) document.getElementById("dashUserName").textContent = me.name || me.email;
      // dates small preview (keeps visual)
      const datesRow = document.getElementById("datesRow");
      if (datesRow) {
        const today = new Date();
        datesRow.innerHTML = [...Array(7)].map((_,i)=>{
          const d = new Date(); d.setDate(today.getDate()+i);
          const short = d.toLocaleDateString(undefined,{weekday:"short"});
          return `<div class="date-pill"><div class="small">${short}</div><div class="fw-bold">${d.getDate()}</div></div>`;
        }).join("");
      }
      // doctors preview
      try {
        const docs = await api("/api/doctors");
        const preview = document.getElementById("doctorsPreview");
        if (preview) {
          preview.innerHTML = docs.slice(0,4).map(d => `
            <div class="col-12 col-md-6">
              <div class="doctor-card p-3">
                <img src="${d.photo_url || 'https://via.placeholder.com/100'}" width="64" height="64">
                <div style="flex:1">
                  <h6 class="mb-0 fw-bold">${d.name}</h6>
                  <small class="muted">${d.department}</small>
                  <div class="mt-2"><a href="/doctor/${d.id}" class="btn btn-sm btn-outline-primary">View</a></div>
                </div>
              </div>
            </div>
          `).join("");
        }
      } catch(e){ console.error(e); }
      // next appointment preview
      try {
        const appts = await api("/api/appointments?mine=1");
        const upcoming = appts.filter(a=>a.status==='scheduled').sort((x,y)=> new Date(x.start_datetime) - new Date(y.start_datetime));
        const nextEl = document.getElementById("nextAppt");
        if (nextEl) {
          if (!upcoming.length) nextEl.innerHTML = `<div class="muted">No upcoming appointments — book one now.</div>`;
          else {
            const n = upcoming[0];
            const doc = await api(`/api/doctors/${n.doctor_id}`);
            nextEl.innerHTML = `<div class="appt-card d-flex justify-content-between align-items-center"><div><div class="small muted">Next</div><div class="fw-bold">${doc.name}</div><div class="muted small">${new Date(n.start_datetime).toLocaleString()}</div></div><div><a href="/appointments" class="btn btn-sm btn-outline-primary">View</a></div></div>`;
          }
        }
      } catch(e){ console.error(e); }
    })();
  }

  // Profile page: populate fields and add edit toggle
  if (document.getElementById("profileForm") || document.getElementById("profileName")) {
    (async ()=>{
      const u = await loadMe();
      if (!u) return;
      const nameEl = document.getElementById("profileName");
      const dobEl = document.getElementById("profileDob");
      const contactEl = document.getElementById("profileContact");
      const emailEl = document.getElementById("profileEmail");
      if (nameEl) nameEl.value = u.name || "";
      if (dobEl) dobEl.value = u.dob || "";
      if (contactEl) contactEl.value = u.contact || "";
      if (emailEl) emailEl.value = u.email || "";

      const profileForm = document.getElementById("profileForm");
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "btn btn-outline-secondary ms-2";
      editBtn.textContent = "Edit";
      profileForm.querySelector(".d-grid")?.prepend(editBtn);

      let editMode = false;
      function setReadonly(state) {
        [nameEl,dobEl,contactEl].forEach(e => { if(e) e.readOnly = state; });
        profileForm.querySelector("button[type='submit']").style.display = state ? "none" : "block";
      }
      setReadonly(true);

      editBtn.addEventListener("click", ()=> {
        editMode = !editMode;
        setReadonly(!editMode);
        editBtn.textContent = editMode ? "Cancel" : "Edit";
      });

      profileForm.addEventListener("submit", async (e)=>{
        e.preventDefault();
        // Simple local update: you can add api to update server if desired
        toast("Profile saved (local)"); // keep it simple for demo
      });
    })();
  }
  // Handle Bill Payments
document.addEventListener("click", async (e) => {
  if (e.target.classList.contains("btn-pay")) {
    const billId = e.target.dataset.id;
    try {
      const res = await fetch(`/api/bills/${billId}/pay`, { method: "POST" });
      if (res.ok) {
        toast("Payment successful!");
        e.target.textContent = "Paid";
        e.target.classList.remove("btn-primary");
        e.target.classList.add("btn-outline-success");
        e.target.disabled = true;
      } else {
        toast("Payment failed!");
      }
    } catch (err) {
      console.error("Payment error:", err);
      toast("Error processing payment");
    }
  }
});

});
