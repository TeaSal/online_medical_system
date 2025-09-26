# app.py
import os
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, abort
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import and_, or_
from sqlalchemy.exc import IntegrityError
from decimal import Decimal

app = Flask(__name__)
# Set DATABASE_URL env var to: mysql+mysqlconnector://user:pass@localhost/meddb
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'mysql+mysqlconnector://root:password@localhost/meddb')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Models
class Doctor(db.Model):
    __tablename__ = 'doctors'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    department = db.Column(db.String(100), nullable=False)
    experience = db.Column(db.Integer, nullable=False, default=0)
    contact = db.Column(db.String(30))
    email = db.Column(db.String(150), unique=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return dict(id=self.id, name=self.name, department=self.department, experience=self.experience,
                    contact=self.contact, email=self.email, created_at=self.created_at.isoformat())

class Patient(db.Model):
    __tablename__ = 'patients'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    dob = db.Column(db.Date)
    gender = db.Column(db.Enum('Male','Female','Other'), default='Other')
    contact = db.Column(db.String(30))
    email = db.Column(db.String(150), unique=True)
    address = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return dict(id=self.id, name=self.name, dob=self.dob.isoformat() if self.dob else None,
                    gender=self.gender, contact=self.contact, email=self.email, address=self.address,
                    created_at=self.created_at.isoformat())

class Appointment(db.Model):
    __tablename__ = 'appointments'
    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False)
    doctor_id = db.Column(db.Integer, db.ForeignKey('doctors.id', ondelete='RESTRICT'), nullable=False)
    start_datetime = db.Column(db.DateTime, nullable=False)
    end_datetime = db.Column(db.DateTime, nullable=False)
    status = db.Column(db.Enum('scheduled','completed','canceled'), default='scheduled')
    reason = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return dict(id=self.id, patient_id=self.patient_id, doctor_id=self.doctor_id,
                    start_datetime=self.start_datetime.isoformat(),
                    end_datetime=self.end_datetime.isoformat(),
                    status=self.status, reason=self.reason, created_at=self.created_at.isoformat())

class Bill(db.Model):
    __tablename__ = 'bills'
    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False)
    appointment_id = db.Column(db.Integer, db.ForeignKey('appointments.id', ondelete='SET NULL'), nullable=True)
    amount = db.Column(db.Numeric(10,2), nullable=False, default=Decimal('0.00'))
    status = db.Column(db.Enum('pending','paid'), default='pending')
    paid_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return dict(id=self.id, patient_id=self.patient_id, appointment_id=self.appointment_id,
                    amount=str(self.amount), status=self.status, paid_at=self.paid_at.isoformat() if self.paid_at else None,
                    created_at=self.created_at.isoformat())

# Utility: check appointment overlap (returns True if overlap exists)
def doctor_has_overlap(doctor_id, start_dt, end_dt, exclude_appointment_id=None):
    q = Appointment.query.filter(
        Appointment.doctor_id == doctor_id,
        Appointment.status != 'canceled',
        Appointment.start_datetime < end_dt,
        Appointment.end_datetime > start_dt
    )
    if exclude_appointment_id:
        q = q.filter(Appointment.id != exclude_appointment_id)
    return db.session.query(q.exists()).scalar()

# Routes: Doctors
@app.route('/doctors', methods=['POST'])
def create_doctor():
    data = request.get_json() or {}
    for k in ('name','department'):
        if k not in data:
            return jsonify({'error': f'{k} is required'}), 400
    d = Doctor(name=data['name'], department=data['department'],
               experience=data.get('experience', 0), contact=data.get('contact'),
               email=data.get('email'))
    db.session.add(d)
    try:
        db.session.commit()
    except IntegrityError as e:
        db.session.rollback()
        return jsonify({'error': 'Integrity error: likely duplicate email/contact'}), 400
    return jsonify(d.to_dict()), 201

@app.route('/doctors', methods=['GET'])
def list_doctors():
    docs = Doctor.query.order_by(Doctor.name).all()
    return jsonify([d.to_dict() for d in docs])

@app.route('/doctors/<int:doc_id>', methods=['GET','PUT','DELETE'])
def doctor_crud(doc_id):
    doc = Doctor.query.get_or_404(doc_id)
    if request.method == 'GET':
        return jsonify(doc.to_dict())
    if request.method == 'PUT':
        data = request.get_json() or {}
        doc.name = data.get('name', doc.name)
        doc.department = data.get('department', doc.department)
        doc.experience = data.get('experience', doc.experience)
        doc.contact = data.get('contact', doc.contact)
        doc.email = data.get('email', doc.email)
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            return jsonify({'error':'Duplicate contact/email or other integrity error'}), 400
        return jsonify(doc.to_dict())
    if request.method == 'DELETE':
        # Restrict deletion: if doctor has non-canceled appointments, reject
        count = Appointment.query.filter(Appointment.doctor_id==doc_id, Appointment.status!='canceled').count()
        if count > 0:
            return jsonify({'error':'Cannot delete doctor with active appointments'}), 400
        db.session.delete(doc)
        db.session.commit()
        return jsonify({'status':'deleted'})

# Routes: Patients
@app.route('/patients', methods=['POST'])
def create_patient():
    data = request.get_json() or {}
    if 'name' not in data:
        return jsonify({'error':'name is required'}), 400
    p = Patient(name=data['name'], dob=(datetime.fromisoformat(data['dob']).date() if data.get('dob') else None),
                gender=data.get('gender','Other'), contact=data.get('contact'), email=data.get('email'),
                address=data.get('address'))
    db.session.add(p)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error':'Duplicate email or integrity error'}), 400
    return jsonify(p.to_dict()), 201

@app.route('/patients', methods=['GET'])
def list_patients():
    ps = Patient.query.order_by(Patient.name).all()
    return jsonify([p.to_dict() for p in ps])

@app.route('/patients/<int:pid>', methods=['GET','PUT','DELETE'])
def patient_crud(pid):
    p = Patient.query.get_or_404(pid)
    if request.method == 'GET':
        return jsonify(p.to_dict())
    if request.method == 'PUT':
        data = request.get_json() or {}
        p.name = data.get('name', p.name)
        if data.get('dob'):
            p.dob = datetime.fromisoformat(data['dob']).date()
        p.gender = data.get('gender', p.gender)
        p.contact = data.get('contact', p.contact)
        p.email = data.get('email', p.email)
        p.address = data.get('address', p.address)
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            return jsonify({'error':'Integrity error/duplicate email'}), 400
        return jsonify(p.to_dict())
    if request.method == 'DELETE':
        # Deleting a patient cascades to appointments and bills (per DB schema)
        db.session.delete(p)
        db.session.commit()
        return jsonify({'status':'deleted'})

# Routes: Appointments
@app.route('/appointments', methods=['POST'])
def create_appointment():
    data = request.get_json() or {}
    required = ('patient_id','doctor_id','start_datetime')
    for r in required:
        if r not in data:
            return jsonify({'error': f'{r} is required'}), 400
    try:
        start = datetime.fromisoformat(data['start_datetime'])
    except Exception:
        return jsonify({'error':'Invalid start_datetime, use ISO format like 2025-09-28T10:00:00'}), 400
    # duration or end_datetime
    if data.get('end_datetime'):
        try:
            end = datetime.fromisoformat(data['end_datetime'])
        except:
            return jsonify({'error':'Invalid end_datetime'}), 400
    else:
        # default 30 minutes
        end = start + timedelta(minutes=30)
    if end <= start:
        return jsonify({'error':'end_datetime must be after start_datetime'}), 400
    # Check patient and doctor exist
    patient = Patient.query.get(data['patient_id'])
    doctor = Doctor.query.get(data['doctor_id'])
    if not patient or not doctor:
        return jsonify({'error':'Invalid patient_id or doctor_id'}), 400
    # DB-level trigger exists, but check here for nicer error message and to avoid wasted transaction
    if doctor_has_overlap(doctor.id, start, end):
        return jsonify({'error':'Appointment clash: doctor already booked during this time'}), 400
    appt = Appointment(patient_id=patient.id, doctor_id=doctor.id, start_datetime=start, end_datetime=end,
                       reason=data.get('reason'))
    db.session.add(appt)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error':'Integrity error (possible overlapping or FK)'}), 400
    return jsonify(appt.to_dict()), 201

@app.route('/appointments', methods=['GET'])
def list_appointments():
    # optional filters: doctor_id, patient_id, from_date, to_date, status
    q = Appointment.query
    doctor_id = request.args.get('doctor_id')
    patient_id = request.args.get('patient_id')
    if doctor_id:
        q = q.filter_by(doctor_id=int(doctor_id))
    if patient_id:
        q = q.filter_by(patient_id=int(patient_id))
    from_date = request.args.get('from')
    to_date = request.args.get('to')
    if from_date:
        try:
            fd = datetime.fromisoformat(from_date)
            q = q.filter(Appointment.start_datetime >= fd)
        except:
            pass
    if to_date:
        try:
            td = datetime.fromisoformat(to_date)
            q = q.filter(Appointment.start_datetime <= td)
        except:
            pass
    appts = q.order_by(Appointment.start_datetime).all()
    return jsonify([a.to_dict() for a in appts])

@app.route('/appointments/<int:aid>', methods=['GET','PATCH','DELETE'])
def appointment_crud(aid):
    a = Appointment.query.get_or_404(aid)
    if request.method == 'GET':
        return jsonify(a.to_dict())
    if request.method == 'PATCH':
        data = request.get_json() or {}
        # allow rescheduling or status change
        if 'start_datetime' in data:
            try:
                new_start = datetime.fromisoformat(data['start_datetime'])
            except:
                return jsonify({'error':'Invalid start_datetime'}), 400
            new_end = None
            if data.get('end_datetime'):
                try:
                    new_end = datetime.fromisoformat(data['end_datetime'])
                except:
                    return jsonify({'error':'Invalid end_datetime'}), 400
            else:
                # keep same duration as before
                duration = a.end_datetime - a.start_datetime
                new_end = new_start + duration
            if new_end <= new_start:
                return jsonify({'error':'end_datetime must be after start_datetime'}), 400
            # check overlap
            if doctor_has_overlap(a.doctor_id, new_start, new_end, exclude_appointment_id=a.id):
                return jsonify({'error':'Appointment clash when rescheduling'}), 400
            a.start_datetime = new_start
            a.end_datetime = new_end
        if 'status' in data:
            if data['status'] not in ('scheduled','completed','canceled'):
                return jsonify({'error':'Invalid status'}), 400
            a.status = data['status']
        if 'reason' in data:
            a.reason = data['reason']
        db.session.commit()
        return jsonify(a.to_dict())
    if request.method == 'DELETE':
        # soft cancel
        a.status = 'canceled'
        db.session.commit()
        return jsonify({'status':'canceled'})

# Routes: Bills
@app.route('/bills', methods=['POST'])
def create_bill():
    data = request.get_json() or {}
    if 'patient_id' not in data or 'amount' not in data:
        return jsonify({'error':'patient_id and amount required'}), 400
    try:
        amt = Decimal(str(data['amount']))
    except:
        return jsonify({'error':'amount must be numeric'}), 400
    if amt < 0:
        return jsonify({'error':'amount must be >= 0'}), 400
    b = Bill(patient_id=data['patient_id'], appointment_id=data.get('appointment_id'), amount=amt, status=data.get('status','pending'))
    db.session.add(b)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error':'Integrity error: invalid patient_id/appointment_id'}), 400
    return jsonify(b.to_dict()), 201

@app.route('/bills', methods=['GET'])
def list_bills():
    patient_id = request.args.get('patient_id')
    q = Bill.query
    if patient_id:
        q = q.filter_by(patient_id=int(patient_id))
    bs = q.order_by(Bill.created_at.desc()).all()
    return jsonify([b.to_dict() for b in bs])

@app.route('/bills/<int:bid>/pay', methods=['POST'])
def pay_bill(bid):
    b = Bill.query.get_or_404(bid)
    if b.status == 'paid':
        return jsonify({'error':'Already paid'}), 400
    b.status = 'paid'
    b.paid_at = datetime.utcnow()
    db.session.commit()
    return jsonify(b.to_dict())

# Simple health endpoint
@app.route('/health')
def health():
    return jsonify({'status':'ok'})

if __name__ == '__main__':
    # On first run, create tables if not present
    with app.app_context():
        db.create_all()
    app.run(host='0.0.0.0', port=5000, debug=True)
