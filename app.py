from flask import Flask, render_template, request, redirect, url_for, jsonify, session, flash
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta

app = Flask(__name__)
app.secret_key = "supersecretkey"

# =====================
# DATABASE CONFIG
# =====================
app.config["SQLALCHEMY_DATABASE_URI"] = "mysql+mysqlconnector://root:tiyu1105@localhost/meddb"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)

# =====================
# MODELS
# =====================
class Doctor(db.Model):
    __tablename__ = "doctors"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    department = db.Column(db.String(100), nullable=False)
    experience = db.Column(db.Integer, default=0)
    contact = db.Column(db.String(30))
    email = db.Column(db.String(150))
    bio = db.Column(db.Text)
    photo_url = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Patient(db.Model):
    __tablename__ = "patients"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    dob = db.Column(db.Date)
    gender = db.Column(db.Enum("Male", "Female", "Other"), default="Other")
    contact = db.Column(db.String(30))
    email = db.Column(db.String(150), unique=True)
    address = db.Column(db.Text)
    password = db.Column(db.String(150))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Appointment(db.Model):
    __tablename__ = "appointments"
    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey("patients.id"), nullable=False)
    doctor_id = db.Column(db.Integer, db.ForeignKey("doctors.id"), nullable=False)
    start_datetime = db.Column(db.DateTime, nullable=False)
    end_datetime = db.Column(db.DateTime, nullable=False)
    status = db.Column(db.Enum("scheduled", "completed", "canceled"), default="scheduled")
    reason = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Favorite(db.Model):
    __tablename__ = "favorites"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("patients.id"), nullable=False)
    doctor_id = db.Column(db.Integer, db.ForeignKey("doctors.id"), nullable=False)

class Bill(db.Model):
    __tablename__ = "bills"
    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey("patients.id"), nullable=False)
    appointment_id = db.Column(db.Integer, db.ForeignKey("appointments.id"), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    status = db.Column(db.Enum("unpaid", "paid", "pending"), default="unpaid")
    paid_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


# =====================
# PAGE ROUTES (Frontend)
# =====================
@app.route("/")
def home_page():
    return render_template("home.html")

@app.route("/login")
def login_page_view():
    return render_template("login.html")

@app.route("/signup")
def signup_page_view():
    return render_template("signup.html")

@app.route("/logout")
def logout_page_view():
    session.clear()
    flash("You have been logged out.", "info")
    return redirect(url_for("home_page"))

@app.route("/dashboard")
def dashboard_page():
    if "user_id" not in session:
        return redirect(url_for("login_page_view"))
    return render_template("dashboard.html")

@app.route("/doctors")
def doctors_page():
    return render_template("doctors.html")

@app.route("/doctor/<int:doctor_id>")
def doctor_info_page(doctor_id):
    return render_template("doctor_info.html")

@app.route("/appointments")
def appointments_page():
    if "user_id" not in session:
        return redirect(url_for("login_page_view"))
    return render_template("appointments.html")

@app.route("/profile")
def profile_page():
    if "user_id" not in session:
        return redirect(url_for("login_page_view"))
    return render_template("profile.html")

@app.route("/doctor/<int:doctor_id>/schedule")
def schedule_page(doctor_id):
    return render_template("schedule.html")

@app.route("/confirm/<int:appt_id>")
def confirm_page(appt_id):
    return render_template("confirm.html")

# =====================
# API ROUTES (Backend)
# =====================

@app.route("/api/login", methods=["POST"])
def api_login():
    data = request.json
    user = Patient.query.filter_by(email=data["email"], password=data["password"]).first()
    if not user:
        return jsonify({"error": "Invalid credentials"}), 401
    session["user_id"] = user.id
    return jsonify({"message": "ok", "user": {"id": user.id, "name": user.name, "email": user.email}})

@app.route("/api/signup", methods=["POST"])
def api_signup():
    data = request.json
    existing = Patient.query.filter_by(email=data["email"]).first()
    if existing:
        return jsonify({"error": "Email already exists"}), 400
    user = Patient(
        name=data["name"],
        email=data["email"],
        password=data["password"],
        contact=data.get("contact"),
        dob=(datetime.fromisoformat(data["dob"]).date() if data.get("dob") else None)
    )
    db.session.add(user)
    db.session.commit()
    session["user_id"] = user.id
    return jsonify({"message": "created", "user": {"id": user.id, "name": user.name}})

@app.route("/api/logout", methods=["POST"])
def api_logout():
    session.clear()
    return jsonify({"message": "logged out"})

@app.route("/api/doctors")
def api_doctors():
    doctors = Doctor.query.all()
    return jsonify([
        {
            "id": d.id,
            "name": d.name,
            "department": d.department,
            "experience": d.experience,
            "bio": d.bio,
            "photo_url": d.photo_url
        } for d in doctors
    ])

@app.route("/api/doctors/<int:doctor_id>")
def api_doctor_detail(doctor_id):
    d = Doctor.query.get_or_404(doctor_id)
    return jsonify({
        "id": d.id,
        "name": d.name,
        "department": d.department,
        "experience": d.experience,
        "bio": d.bio,
        "photo_url": d.photo_url
    })
@app.route("/api/me")
def api_me():
    if "user_id" not in session:
        return jsonify({"user": None})
    print("Current session user_id:", session["user_id"])
    u = Patient.query.get(session["user_id"])
    return jsonify({
        "user": {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "contact": u.contact,
            "dob": (u.dob.isoformat() if u.dob else None)
        }
    })

@app.route("/api/appointments", methods=["GET", "POST"])
def api_appointments():
    if request.method == "POST":
        if "user_id" not in session:
            return jsonify({"error": "Unauthorized"}), 401
        data = request.json
        try:
            start = datetime.fromisoformat(data["start_datetime"])
            end = start + timedelta(minutes=30)
            new_appt = Appointment(
                patient_id=session["user_id"],
                doctor_id=data["doctor_id"],
                start_datetime=start,
                end_datetime=end,
                reason=data.get("notes", "")
            )
            db.session.add(new_appt)
            db.session.flush()  # to get appointment ID before commit

            new_bill = Bill(
                patient_id=session["user_id"],
                appointment_id=new_appt.id,
                amount=500.0,  # flat consultation fee
                status="unpaid"
            )
            db.session.add(new_bill)
            db.session.commit()

            return jsonify({"id": new_appt.id, "bill_id": new_bill.id})
        except Exception as e:
            db.session.rollback()
            print("Error:", e)
            return jsonify({"error": "Booking failed"}), 500



        return jsonify({"id": new_appt.id, "bill_id": new_bill.id})

    # ---------- GET ----------
    mine = request.args.get("mine")
    appts = None
    if mine and "user_id" in session:
        appts = Appointment.query.filter_by(patient_id=session["user_id"]).order_by(Appointment.start_datetime).all()
    else:
        appts = Appointment.query.order_by(Appointment.start_datetime).all()

    out = []
    for a in appts:
        d = Doctor.query.get(a.doctor_id)
        p = Patient.query.get(a.patient_id)
        out.append({
            "id": a.id,
            "doctor_id": a.doctor_id,
            "doctor_name": d.name if d else None,
            "patient_id": a.patient_id,
            "patient_name": p.name if p else None,
            "start_datetime": a.start_datetime.isoformat(),
            "end_datetime": a.end_datetime.isoformat(),
            "status": a.status,
            "reason": a.reason
        })
    return jsonify(out)


@app.route("/api/appointments/<int:appt_id>")
def api_appointment_detail(appt_id):
    a = Appointment.query.get_or_404(appt_id)
    return jsonify({
        "id": a.id,
        "doctor_id": a.doctor_id,
        "patient_id": a.patient_id,
        "start_datetime": a.start_datetime.isoformat(),
        "end_datetime": a.end_datetime.isoformat(),
        "status": a.status,
        "reason": a.reason
    })

@app.route("/api/appointments/<int:appt_id>", methods=["DELETE"])
def api_appointment_delete(appt_id):
    a = Appointment.query.get_or_404(appt_id)
    if a.patient_id != session.get("user_id"):
        return jsonify({"error": "unauthorized"}), 403
    a.status = "canceled"
    db.session.commit()
    return jsonify({"message": "canceled"})

@app.route("/api/favorites", methods=["GET", "POST"])
def api_favorites():
    if "user_id" not in session:
        return jsonify([])

    if request.method == "GET":
        favs = Favorite.query.filter_by(user_id=session["user_id"]).all()
        return jsonify([
            {
                "doctor_id": f.doctor_id,
                "doctor_name": Doctor.query.get(f.doctor_id).name,
                "department": Doctor.query.get(f.doctor_id).department,
                "photo_url": Doctor.query.get(f.doctor_id).photo_url
            } for f in favs
        ])
    else:
        data = request.json
        # If already exists, return ok (idempotent)
        exists = Favorite.query.filter_by(user_id=session["user_id"], doctor_id=data["doctor_id"]).first()
        if exists:
            return jsonify({"message": "already favorited"})
        fav = Favorite(user_id=session["user_id"], doctor_id=data["doctor_id"])
        db.session.add(fav)
        db.session.commit()
        return jsonify({"message": "favorited"})

@app.route("/api/favorites/<int:doctor_id>", methods=["DELETE"])
def api_delete_favorite(doctor_id):
    fav = Favorite.query.filter_by(user_id=session.get("user_id"), doctor_id=doctor_id).first()
    if fav:
        db.session.delete(fav)
        db.session.commit()
    return jsonify({"message": "unfavorited"})

@app.route("/api/bills")
def api_bills():
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    bills = Bill.query.filter_by(patient_id=session["user_id"]).all()
    return jsonify([
        {
            "id": b.id,
            "appointment_id": b.appointment_id,
            "amount": b.amount,
            "status": b.status,
            "paid_at": b.paid_at.isoformat() if b.paid_at else None,
            "created_at": b.created_at.isoformat()
        } for b in bills
    ])
@app.route("/bills")
def bills_page():
    if "user_id" not in session:
        return redirect(url_for("login_page_view"))
    return render_template("bills.html")


# =====================
# SEED DATA
# =====================
def seed_doctors():
    if Doctor.query.count() == 0:
        d1 = Doctor(
            name="Dr. Olivia Turner", department="Dermatology", experience=15,
            contact="+91-9876543210", email="olivia@example.com",
            bio="Specialist in skin care and endocrine disorders.",
            photo_url="https://randomuser.me/api/portraits/women/46.jpg"
        )
        d2 = Doctor(
            name="Dr. Rahul Mehra", department="General Medicine", experience=8,
            contact="+91-9123456780", email="rahul@example.com",
            bio="Experienced general physician with holistic care.",
            photo_url="https://randomuser.me/api/portraits/men/45.jpg"
        )
        db.session.add_all([d1, d2])
        db.session.commit()

# =====================
# RUN APP
# =====================
if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        seed_doctors()
    app.run(debug=True)
