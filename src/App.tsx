/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  Plus, 
  Trash2, 
  Calculator, 
  Users, 
  Wallet, 
  BookOpen, 
  Download,
  CheckCircle2,
  XCircle,
  FileText,
  FileSpreadsheet,
  LayoutDashboard,
  UserPlus,
  Database,
  LogIn,
  LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import StudentRegistration from './components/StudentRegistration';
import StudentDatabase from './components/StudentDatabase';

// --- Constants & Types ---

type SubjectKey = 'P' | 'C' | 'M' | 'B' | 'I';

interface SubjectInfo {
  id: SubjectKey;
  name: string;
  basePrice: number;
  color: string;
}

const SUBJECTS: SubjectInfo[] = [
  { id: 'P', name: 'Physics', basePrice: 2000, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { id: 'C', name: 'Chemistry', basePrice: 2000, color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { id: 'M', name: 'H. Math', basePrice: 2000, color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { id: 'B', name: 'Biology', basePrice: 1500, color: 'bg-rose-100 text-rose-700 border-rose-200' },
  { id: 'I', name: 'ICT', basePrice: 1500, color: 'bg-amber-100 text-amber-700 border-amber-200' },
];

interface Transaction {
  id: string;
  studentName: string;
  selectedSubjects: SubjectKey[];
  totalPaid: number;
  splits: Record<SubjectKey, number>;
  timestamp: number;
}

// --- Helper Functions ---

const calculateSplits = (selectedSubjects: SubjectKey[], totalPaid: number): Record<SubjectKey, number> => {
  const splits: Record<SubjectKey, number> = { P: 0, C: 0, M: 0, B: 0, I: 0 };
  
  if (selectedSubjects.length === 0) return splits;

  const baseSum = selectedSubjects.reduce((sum, subId) => {
    const sub = SUBJECTS.find(s => s.id === subId);
    return sum + (sub?.basePrice || 0);
  }, 0);

  selectedSubjects.forEach(subId => {
    const sub = SUBJECTS.find(s => s.id === subId);
    if (sub) {
      // Formula: (Base Price of Subject / Sum of Base Prices for Selected Subjects) * Actual Total Payment Received
      const share = (sub.basePrice / baseSum) * totalPaid;
      splits[subId] = Number(share.toFixed(2));
    }
  });

  return splits;
};

// --- Components ---

export default function App() {
  const [activeTab, setActiveTab] = useState<'splitter' | 'registration' | 'database'>('splitter');
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [studentName, setStudentName] = useState('');
  const [selectedSubjects, setSelectedSubjects] = useState<SubjectKey[]>([]);
  const [amountReceived, setAmountReceived] = useState<string>('');

  const [isClearModalOpen, setIsClearModalOpen] = useState(false);

  // --- Derived State ---

  const totals = useMemo(() => {
    const initialTotals = {
      totalRevenue: 0,
      P: 0, C: 0, M: 0, B: 0, I: 0
    };

    return transactions.reduce((acc, t) => {
      acc.totalRevenue += t.totalPaid;
      acc.P += t.splits.P;
      acc.C += t.splits.C;
      acc.M += t.splits.M;
      acc.B += t.splits.B;
      acc.I += t.splits.I;
      return acc;
    }, initialTotals);
  }, [transactions]);

  // --- Handlers ---

  const toggleSubject = (id: SubjectKey) => {
    setSelectedSubjects(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const handleAddRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName || selectedSubjects.length === 0 || !amountReceived) return;

    const paid = parseFloat(amountReceived);
    if (isNaN(paid)) return;

    const newTransaction: Transaction = {
      id: crypto.randomUUID(),
      studentName,
      selectedSubjects,
      totalPaid: paid,
      splits: calculateSplits(selectedSubjects, paid),
      timestamp: Date.now(),
    };

    setTransactions([newTransaction, ...transactions]);
    
    // Reset form
    setStudentName('');
    setSelectedSubjects([]);
    setAmountReceived('');
  };

  const removeTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const confirmClearAll = () => {
    setTransactions([]);
    setIsClearModalOpen(false);
  };

  const exportToExcel = () => {
    if (transactions.length === 0) return;

    const exportData = transactions.map(t => ({
      'Student ID/Name :': t.studentName,
      'Selected Subjects': t.selectedSubjects.join(', '),
      'Total Paid (৳)': t.totalPaid,
      'Physics (P)': t.splits.P,
      'Chemistry (C)': t.splits.C,
      'Math (M)': t.splits.M,
      'Biology (B)': t.splits.B,
      'ICT (I)': t.splits.I,
      'Date': new Date(t.timestamp).toLocaleString()
    }));

    // Add summary row
    exportData.push({
      'Student ID/Name :': 'TOTALS',
      'Selected Subjects': '',
      'Total Paid (৳)': totals.totalRevenue,
      'Physics (P)': totals.P,
      'Chemistry (C)': totals.C,
      'Math (M)': totals.M,
      'Biology (B)': totals.B,
      'ICT (I)': totals.I,
      'Date': ''
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Daily Revenue");

    // Auto-size columns
    const maxWidths = Object.keys(exportData[0]).map(key => {
      return Math.max(
        key.length,
        ...exportData.map(row => String(row[key as keyof typeof row]).length)
      );
    });
    worksheet['!cols'] = maxWidths.map(w => ({ wch: w + 2 }));

    XLSX.writeFile(workbook, `revenue_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Calculator className="w-8 h-8 text-blue-600" />
              Spondon Financial Management
            </h1>
            <p className="text-slate-500 mt-1">Coaching Center Management System</p>
          </div>

          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            <button 
              onClick={() => setActiveTab('splitter')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'splitter' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <LayoutDashboard className="w-4 h-4" />
              Splitter
            </button>
            <button 
              onClick={() => setActiveTab('registration')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'registration' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <UserPlus className="w-4 h-4" />
              Register
            </button>
            <button 
              onClick={() => setActiveTab('database')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'database' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <Database className="w-4 h-4" />
              Students
            </button>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-end">
                  <span className="text-xs font-bold text-slate-900">{user.displayName}</span>
                  <span className="text-[10px] text-slate-400">{user.email}</span>
                </div>
                <button 
                  onClick={handleLogout}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button 
                onClick={handleLogin}
                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Login
              </button>
            )}
            {activeTab === 'splitter' && (
              <>
                <button 
                  onClick={() => setIsClearModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear Day
                </button>
                <button 
                  onClick={exportToExcel}
                  disabled={transactions.length === 0}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Export Excel
                </button>
              </>
            )}
          </div>
        </header>

        <main>
          {authLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !user && activeTab !== 'splitter' ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm text-center space-y-4">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                <Users className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900">Authentication Required</h3>
                <p className="text-slate-500 max-w-md mx-auto">
                  Please login with your Google account to access the Student Management and Database features.
                </p>
              </div>
              <button 
                onClick={handleLogin}
                className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all"
              >
                Login with Google
              </button>
            </div>
          ) : (
            <>
              {activeTab === 'splitter' && (
                <div className="space-y-8">
                  {/* Aggregation Dashboard */}
                  <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                    <div className="col-span-1 sm:col-span-2 lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-2">
                        <Wallet className="w-5 h-5 text-blue-600" />
                        <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Total Revenue</span>
                      </div>
                      <div className="text-2xl font-bold text-slate-900">
                        ৳{totals.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                      <div className="mt-2 text-xs text-slate-400">Today's collection</div>
                    </div>

                    {SUBJECTS.map(sub => (
                      <div key={sub.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-2">
                          <BookOpen className="w-5 h-5 text-slate-400" />
                          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">{sub.name}</span>
                        </div>
                        <div className="text-2xl font-bold text-slate-900">
                          ৳{totals[sub.id].toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                        <div className="mt-2 text-xs text-slate-400">Base: ৳{sub.basePrice}</div>
                      </div>
                    ))}
                  </section>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Data Entry Form */}
                    <section className="lg:col-span-1">
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden sticky top-8">
                        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                          <h2 className="text-lg font-semibold flex items-center gap-2">
                            <Plus className="w-5 h-5 text-blue-600" />
                            New Entry
                          </h2>
                        </div>
                        <form onSubmit={handleAddRecord} className="p-6 space-y-6">
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Student ID/Name :</label>
                            <input 
                              type="text" 
                              required
                              value={studentName}
                              onChange={e => setStudentName(e.target.value)}
                              placeholder="e.g. John Doe #001"
                              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            />
                          </div>

                          <div className="space-y-3">
                            <label className="text-sm font-medium text-slate-700">Select Subjects</label>
                            <div className="grid grid-cols-1 gap-2">
                              {SUBJECTS.map(sub => (
                                <button
                                  key={sub.id}
                                  type="button"
                                  onClick={() => toggleSubject(sub.id)}
                                  className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                                    selectedSubjects.includes(sub.id)
                                      ? 'bg-blue-50 border-blue-200 text-blue-700 ring-1 ring-blue-200'
                                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${sub.color}`}>
                                      {sub.id}
                                    </div>
                                    <div className="text-left">
                                      <div className="font-semibold text-sm">{sub.name}</div>
                                      <div className="text-[10px] opacity-70">Base: ৳{sub.basePrice}</div>
                                    </div>
                                  </div>
                                  {selectedSubjects.includes(sub.id) ? (
                                    <CheckCircle2 className="w-5 h-5 text-blue-600" />
                                  ) : (
                                    <div className="w-5 h-5 rounded-full border-2 border-slate-200" />
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Actual Amount Received (৳)</label>
                            <div className="relative">
                              <Wallet className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <input 
                                type="number" 
                                required
                                min="0"
                                step="0.01"
                                value={amountReceived}
                                onChange={e => setAmountReceived(e.target.value)}
                                placeholder="0.00"
                                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                              />
                            </div>
                          </div>

                          <button 
                            type="submit"
                            disabled={!studentName || selectedSubjects.length === 0 || !amountReceived}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
                          >
                            <Plus className="w-5 h-5" />
                            Add to Ledger
                          </button>
                        </form>
                      </div>
                    </section>

                    {/* Ledger Table */}
                    <section className="lg:col-span-2 space-y-4">
                      <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold flex items-center gap-2 text-slate-700">
                          <FileText className="w-5 h-5" />
                          Daily Ledger
                          <span className="ml-2 px-2 py-0.5 bg-slate-100 text-slate-500 text-xs rounded-full">
                            {transactions.length} Records
                          </span>
                        </h2>
                      </div>

                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">SL</th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Student ID/Name :</th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Paid</th>
                                {SUBJECTS.map(sub => (
                                  <th key={sub.id} className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-center">
                                    {sub.name}
                                  </th>
                                ))}
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              <AnimatePresence mode="popLayout">
                                {transactions.length === 0 ? (
                                  <motion.tr 
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="text-center"
                                  >
                                    <td colSpan={9} className="px-6 py-12 text-slate-400 italic">
                                      No records entered yet. Start by adding a student.
                                    </td>
                                  </motion.tr>
                                ) : (
                                  transactions.map((t, index) => (
                                    <motion.tr 
                                      key={t.id}
                                      layout
                                      initial={{ opacity: 0, x: -20 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      exit={{ opacity: 0, scale: 0.95 }}
                                      className="hover:bg-slate-50/50 transition-colors group"
                                    >
                                      <td className="px-6 py-4 text-xs font-bold text-slate-400">
                                        {transactions.length - index}
                                      </td>
                                      <td className="px-6 py-4">
                                        <div className="font-semibold text-slate-900">{t.studentName}</div>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {t.selectedSubjects.map(sid => (
                                            <span key={sid} className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-bold rounded">
                                              {sid}
                                            </span>
                                          ))}
                                        </div>
                                      </td>
                                      <td className="px-6 py-4 font-mono text-sm font-bold text-blue-600">
                                        ৳{t.totalPaid.toFixed(2)}
                                      </td>
                                      {SUBJECTS.map(sub => (
                                        <td key={sub.id} className={`px-6 py-4 text-center font-mono text-xs ${t.splits[sub.id] > 0 ? 'text-slate-700 font-medium' : 'text-slate-300'}`}>
                                          {t.splits[sub.id] > 0 ? `৳${t.splits[sub.id].toFixed(2)}` : '—'}
                                        </td>
                                      ))}
                                      <td className="px-6 py-4 text-right">
                                        <button 
                                          onClick={() => removeTransaction(t.id)}
                                          className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                        >
                                          <XCircle className="w-5 h-5" />
                                        </button>
                                      </td>
                                    </motion.tr>
                                  ))
                                )}
                              </AnimatePresence>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </section>
                  </div>
                </div>
              )}

              {activeTab === 'registration' && <StudentRegistration />}
              {activeTab === 'database' && <StudentDatabase />}
            </>
          )}
        </main>
      </div>

      {/* Footer Info */}
      <footer className="max-w-7xl mx-auto mt-12 pt-8 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-400 text-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            System Active
          </div>
          <span>•</span>
          <div>Proportional Split Logic: Enabled</div>
        </div>
        <div>
          © {new Date().getFullYear()} Spondon mirpur 10
        </div>
      </footer>
    </div>
  );
}
