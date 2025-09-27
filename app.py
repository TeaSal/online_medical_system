from flask import Flask, request, jsonify, render_template, abort, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import os

app = Flask(__name__)

# ----------------------------
# Database Config
# ----------------------------
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv(
    "DATABASE_URL",
    "sqlite:///temp.db"   # fallback to SQLite for easy local testing
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# ----------------------------
# Models
# ----------------------------
class Doctor(db.Model):
    __tablename__ = "doctors"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    department = db.Column(db.String(100))
    experience = db.Column(db.Integer)
    contact = db.Column(db.String(20), unique=True)
    email = db.Column(db.String(120), unique=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class Patient(db.Model):
    __tablename__ = "patients"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    dob = db.Column(db.Date)
    gender = db.Column(db.String(10))
    contact = db.Column(db.String(20), unique=True)
    email = db.Column(db.String(120), unique=True)


class Appointment(db.Model):
    __tablename__ = "appointments"
    id = db.Column(db.Integer, primary_key=True)
    doctor_id = db.Column(db.Integer, db.ForeignKey("doctors.id"), nullable=False)
    patient_id = db.Column(db.Integer, db.ForeignKey("patients.id"), nullable=False)
    start_datetime = db.Column(db.DateTime, nullable=False)
    status = db.Column(db.String(20), default="scheduled")


class Bill(db.Model):
    __tablename__ = "bills"
    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey("patients.id"), nullable=False)
    appointment_id = db.Column(db.Integer, db.ForeignKey("appointments.id"), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    paid_date = db.Column(db.DateTime, nullable=True)

# ----------------------------
# Frontend Routes (Person B)
# ----------------------------
@app.route("/")
def home():
    return render_template("home.html")

@app.route("/login")
def login():
    return render_template("login.html")

@app.route("/signup")
def signup():
    return render_template("signup.html")

@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html")

@app.route("/doctors")
def doctors_page():
    return render_template("doctors.html")

@app.route("/doctor/<int:doc_id>")
def doctor_info(doc_id):
    return render_template("doctor_info.html", doc_id=doc_id)

@app.route("/doctor/<int:doc_id>/book")
def book(doc_id):
    return render_template("book.html", doc_id=doc_id)

@app.route("/appointments_ui")
def appointments_ui():
    return render_template("appointments.html")

# ----------------------------
# Backend API Routes
# ----------------------------

# Doctors API
@app.route("/api/doctors", methods=["GET", "POST"])
def doctors_api():
    if request.method == "GET":
        doctors = Doctor.query.all()
        return jsonify([
            {
                "id": d.id,
                "name": d.name,
                "department": d.department,
                "experience": d.experience,
                "contact": d.contact,
                "email": d.email,
                "created_at": d.created_at
            }
            for d in doctors
        ])

    elif request.method == "POST":
        data = request.get_json()
        new_doc = Doctor(
            name=data.get("name"),
            department=data.get("department"),
            experience=data.get("experience"),
            contact=data.get("contact"),
            email=data.get("email"),
        )
        db.session.add(new_doc)
        db.session.commit()
        return jsonify({
            "id": new_doc.id,
            "name": new_doc.name,
            "department": new_doc.department,
            "experience": new_doc.experience,
            "contact": new_doc.contact,
            "email": new_doc.email,
            "created_at": new_doc.created_at
        })

# Patients API
@app.route("/api/patients", methods=["GET", "POST"])
def patients_api():
    if request.method == "GET":
        patients = Patient.query.all()
        return jsonify([
            {
                "id": p.id,
                "name": p.name,
                "dob": p.dob,
                "gender": p.gender,
                "contact": p.contact,
                "email": p.email
            }
            for p in patients
        ])

    elif request.method == "POST":
        data = request.get_json()
        new_patient = Patient(
            name=data.get("name"),
            dob=data.get("dob"),
            gender=data.get("gender"),
            contact=data.get("contact"),
            email=data.get("email"),
        )
        db.session.add(new_patient)
        db.session.commit()
        return jsonify({
            "id": new_patient.id,
            "name": new_patient.name,
            "dob": new_patient.dob,
            "gender": new_patient.gender,
            "contact": new_patient.contact,
            "email": new_patient.email
        })

# Appointments API
@app.route("/api/appointments", methods=["GET", "POST"])
def appointments_api():
    if request.method == "GET":
        appts = Appointment.query.all()
        return jsonify([
            {
                "id": a.id,
                "doctor_id": a.doctor_id,
                "patient_id": a.patient_id,
                "start_datetime": a.start_datetime,
                "status": a.status
            }
            for a in appts
        ])

    elif request.method == "POST":
        data = request.get_json()
        new_appt = Appointment(
            doctor_id=data.get("doctor_id"),
            patient_id=data.get("patient_id"),
            start_datetime=datetime.fromisoformat(data.get("start_datetime")),
            status="scheduled"
        )
        db.session.add(new_appt)
        db.session.commit()
        return jsonify({
            "id": new_appt.id,
            "doctor_id": new_appt.doctor_id,
            "patient_id": new_appt.patient_id,
            "start_datetime": new_appt.start_datetime,
            "status": new_appt.status
        })

# Bills API
@app.route("/api/bills", methods=["GET", "POST"])
def bills_api():
    if request.method == "GET":
        bills = Bill.query.all()
        return jsonify([
            {
                "id": b.id,
                "patient_id": b.patient_id,
                "appointment_id": b.appointment_id,
                "amount": b.amount,
                "paid_date": b.paid_date
            }
            for b in bills
        ])

    elif request.method == "POST":
        data = request.get_json()
        new_bill = Bill(
            patient_id=data.get("patient_id"),
            appointment_id=data.get("appointment_id"),
            amount=data.get("amount"),
        )
        db.session.add(new_bill)
        db.session.commit()
        return jsonify({
            "id": new_bill.id,
            "patient_id": new_bill.patient_id,
            "appointment_id": new_bill.appointment_id,
            "amount": new_bill.amount,
            "paid_date": new_bill.paid_date
        })

@app.route("/api/bills/<int:bill_id>/pay", methods=["POST"])
def pay_bill(bill_id):
    bill = Bill.query.get_or_404(bill_id)
    bill.paid_date = datetime.utcnow()
    db.session.commit()
    return jsonify({
        "id": bill.id,
        "status": "paid",
        "paid_date": bill.paid_date
    })

# ----------------------------
# Entry Point
# ----------------------------
if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True)
