import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, updateDoc, addDoc, getDoc, where } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { Search, Users, CreditCard, History, X, Download, Loader2, Eye, FileText, MapPin, Phone, Receipt } from 'lucide-react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

interface Student {
  id: string;
  name: string;
  phone: string;
  address?: string;
  parentPhone?: string;
  grade: string;
  totalFees: number;
  pendingFees: number;
  courseIds: string[];
}

interface Course {
  id: string;
  name: string;
  fee: number;
}

export default function StudentDatabase() {
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [viewDetailsStudent, setViewDetailsStudent] = useState<Student | null>(null);
  const [studentInvoices, setStudentInvoices] = useState<any[]>([]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) {
      setStudents([]);
      setCourses([]);
      return;
    }

    const unsubStudents = onSnapshot(collection(db, 'students'), (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
    }, (error) => {
      console.error("Students fetch error:", error);
    });
    
    const unsubCourses = onSnapshot(collection(db, 'courses'), (snapshot) => {
      setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
    }, (error) => {
      console.error("Courses fetch error:", error);
    });
    
    return () => {
      unsubStudents();
      unsubCourses();
    };
  }, [user]);

  useEffect(() => {
    if (!viewDetailsStudent) {
      setStudentInvoices([]);
      return;
    }

    const q = query(
      collection(db, 'invoices'),
      where('studentId', '==', viewDetailsStudent.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort by date descending
      docs.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setStudentInvoices(docs);
    });

    return () => unsubscribe();
  }, [viewDetailsStudent]);

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.phone.includes(searchTerm) ||
    s.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handlePayment = async () => {
    if (!selectedStudent || !paymentAmount) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) return;

    setLoading(true);
    try {
      const newPending = selectedStudent.pendingFees - amount;
      
      // 1. Update Student pending fees
      await updateDoc(doc(db, 'students', selectedStudent.id), {
        pendingFees: newPending
      });

      // 2. Record Payment
      const paymentData = {
        studentId: selectedStudent.id,
        amount,
        date: new Date().toISOString(),
        details: `Payment for ${selectedStudent.name}`,
      };
      const paymentRef = await addDoc(collection(db, 'payments'), paymentData);

      // 3. Generate Invoice Record
      const studentCourses = courses.filter(c => selectedStudent.courseIds.includes(c.id));
      const invoiceData = {
        studentId: selectedStudent.id,
        studentName: selectedStudent.name,
        courses: studentCourses,
        amountPaid: amount,
        totalFees: selectedStudent.totalFees,
        status: newPending <= 0 ? 'Full' : 'Partial',
        date: new Date().toISOString(),
        paymentId: paymentRef.id
      };
      await addDoc(collection(db, 'invoices'), invoiceData);

      // 4. Generate PDF
      generatePDF(invoiceData, selectedStudent);

      alert('Payment recorded and Invoice generated!');
      setSelectedStudent(null);
      setPaymentAmount('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'payments');
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = (invoice: any, student: Student) => {
    const doc = new jsPDF() as any;
    
    doc.setFontSize(20);
    doc.text('SPONDON FINANCIAL MANAGEMENT', 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text('Mirpur 10, Dhaka', 105, 28, { align: 'center' });
    
    doc.line(20, 35, 190, 35);
    
    doc.setFontSize(14);
    doc.text('INVOICE', 20, 45);
    doc.setFontSize(10);
    doc.text(`Date: ${new Date(invoice.date).toLocaleString()}`, 140, 45);
    
    doc.text(`Student ID/Name : ${student.name}`, 20, 55);
    doc.text(`System ID: ${student.id}`, 20, 62);
    doc.text(`Phone: ${student.phone}`, 20, 69);
    doc.text(`Grade: ${student.grade}`, 20, 76);

    const tableData = invoice.courses.map((c: any) => [c.name, `৳${c.fee}`]);
    doc.autoTable({
      startY: 85,
      head: [['Course Name', 'Fee']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillStyle: [59, 130, 246] }
    });

    const finalY = (doc as any).lastAutoTable.cursor.y + 10;
    doc.text(`Total Fees: ৳${invoice.totalFees}`, 140, finalY);
    doc.text(`Amount Paid: ৳${invoice.amountPaid}`, 140, finalY + 7);
    doc.setFontSize(12);
    doc.setTextColor(59, 130, 246);
    doc.text(`Status: ${invoice.status} Payment`, 140, finalY + 15);

    doc.save(`Invoice_${student.name}_${new Date().getTime()}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input 
            type="text"
            placeholder="Search by Student ID/Name, Phone..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none"
          />
        </div>
        <div className="flex items-center gap-2 text-slate-500 font-medium">
          <Users className="w-5 h-5" />
          {filteredStudents.length} Students
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredStudents.map(student => (
          <div key={student.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">{student.name}</h3>
                <p className="text-sm text-slate-500">{student.grade}</p>
              </div>
              <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${student.pendingFees <= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {student.pendingFees <= 0 ? 'Paid' : 'Pending'}
              </div>
            </div>
            
            <div className="space-y-2 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Total Fees:</span>
                <span className="font-bold">৳{student.totalFees}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Pending:</span>
                <span className="font-bold text-rose-600">৳{student.pendingFees}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => setViewDetailsStudent(student)}
                className="flex-1 py-2 bg-slate-50 text-slate-600 hover:bg-slate-100 font-bold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Eye className="w-4 h-4" />
                Details
              </button>
              <button 
                onClick={() => setSelectedStudent(student)}
                className="flex-1 py-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                Pay
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Payment Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedStudent(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold">Collect Payment</h3>
              <button onClick={() => setSelectedStudent(null)}><X className="w-6 h-6 text-slate-400" /></button>
            </div>
            
            <div className="p-4 bg-slate-50 rounded-xl space-y-1">
              <div className="text-sm text-slate-500">Paying for</div>
              <div className="font-bold text-lg">{selectedStudent.name}</div>
              <div className="text-sm text-rose-600 font-bold">Pending: ৳{selectedStudent.pendingFees}</div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Payment Amount (৳)</label>
              <input 
                type="number"
                value={paymentAmount}
                onChange={e => setPaymentAmount(e.target.value)}
                placeholder="Enter amount"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none"
              />
            </div>

            <button 
              onClick={handlePayment}
              disabled={loading || !paymentAmount}
              className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
              Process & Generate Invoice
            </button>
          </div>
        </div>
      )}

      {/* Student Details Modal */}
      {viewDetailsStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setViewDetailsStudent(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-8 max-w-2xl w-full space-y-8 my-8">
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black text-slate-900">Student Profile</h3>
              <button onClick={() => setViewDetailsStudent(null)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Personal Information</h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-slate-600">
                      <Users className="w-5 h-5 text-blue-500" />
                      <span className="font-bold">{viewDetailsStudent.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-600">
                      <Phone className="w-5 h-5 text-blue-500" />
                      <span>{viewDetailsStudent.phone}</span>
                    </div>
                    {viewDetailsStudent.parentPhone && (
                      <div className="flex items-center gap-3 text-slate-600">
                        <Phone className="w-5 h-5 text-emerald-500" />
                        <span className="text-sm">Parent: {viewDetailsStudent.parentPhone}</span>
                      </div>
                    )}
                    {viewDetailsStudent.address && (
                      <div className="flex items-center gap-3 text-slate-600">
                        <MapPin className="w-5 h-5 text-rose-500" />
                        <span className="text-sm">{viewDetailsStudent.address}</span>
                      </div>
                    )}
                    <div className="inline-block px-3 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded-full">
                      {viewDetailsStudent.grade}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Financial Summary</h4>
                  <div className="p-4 bg-slate-50 rounded-2xl space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Total Enrollment Fees</span>
                      <span className="font-bold">৳{viewDetailsStudent.totalFees}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Pending Balance</span>
                      <span className="font-bold text-rose-600">৳{viewDetailsStudent.pendingFees}</span>
                    </div>
                    <div className="pt-2 border-t border-slate-200">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Status</span>
                        <span className={`font-bold ${viewDetailsStudent.pendingFees <= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {viewDetailsStudent.pendingFees <= 0 ? 'Fully Paid' : 'Payment Pending'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Transaction History</h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">
                    {studentInvoices.length} Records
                  </span>
                </div>
                
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {studentInvoices.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <Receipt className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                      <p className="text-slate-400 italic text-sm">No transactions found.</p>
                    </div>
                  ) : (
                    studentInvoices.map((invoice) => (
                      <div key={invoice.id} className="p-4 bg-white border border-slate-100 rounded-2xl hover:border-blue-200 hover:shadow-sm transition-all group relative overflow-hidden">
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${invoice.status === 'Full' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        
                        <div className="flex justify-between items-start mb-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-slate-900">৳{invoice.amountPaid.toLocaleString()}</span>
                              <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                                invoice.status === 'Full' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                              }`}>
                                {invoice.status}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1">
                              <History className="w-3 h-3" />
                              {new Date(invoice.date).toLocaleString(undefined, { 
                                dateStyle: 'medium', 
                                timeStyle: 'short' 
                              })}
                            </div>
                          </div>
                          <button 
                            onClick={() => generatePDF(invoice, viewDetailsStudent)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                            title="Download Invoice PDF"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-1">
                            {invoice.courses.map((c: any, i: number) => (
                              <span key={i} className="text-[9px] px-2 py-0.5 bg-slate-50 text-slate-600 font-medium rounded-md border border-slate-100">
                                {c.name}
                              </span>
                            ))}
                          </div>
                          <div className="pt-2 border-t border-slate-50 flex justify-between items-center">
                            <span className="text-[9px] text-slate-400 font-mono">Inv ID: {invoice.id.slice(0, 8)}... | Student ID: {viewDetailsStudent.id.slice(0, 8)}...</span>
                            <span className="text-[9px] text-slate-500 font-bold">Total: ৳{invoice.totalFees}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
