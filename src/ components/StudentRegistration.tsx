import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { UserPlus, Save, Loader2, CheckCircle2 } from 'lucide-react';

const GRADES = ['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'HSC 1st Year', 'HSC 2nd Year'];

interface Course {
  id: string;
  name: string;
  fee: number;
}

export default function StudentRegistration() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [user, setUser] = useState(auth.currentUser);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    parentPhone: '',
    grade: '',
    selectedCourseIds: [] as string[],
  });

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    setCoursesLoading(true);
    const q = query(collection(db, 'courses'), orderBy('name'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const courseList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
      
      const defaults = [
        { name: 'Physics', fee: 2000 },
        { name: 'Chemistry', fee: 2000 },
        { name: 'H. Math', fee: 2000 },
        { name: 'Biology', fee: 1500 },
        { name: 'ICT', fee: 1500 },
      ];

      // Ensure all default courses exist
      const missingDefaults = defaults.filter(d => !courseList.some(c => c.name === d.name));
      
      const isAdmin = user && (user.email === 'shabbir.bindulogic2@gmail.com' || user.email === 'admin@example.com');

      if (missingDefaults.length > 0 && courseList.length < 5 && isAdmin) {
        try {
          for (const d of missingDefaults) {
            await addDoc(collection(db, 'courses'), d);
          }
        } catch (error) {
          console.error('Seeding error:', error);
          // Only show error if we have NO courses at all
          if (courseList.length === 0) {
            setCoursesError('Failed to seed default courses. Are you an admin?');
          }
        }
      }

      if (courseList.length > 0) {
        setCourses(courseList);
        setCoursesLoading(false);
        setCoursesError(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'courses');
      setCoursesError('Permission denied or connection error');
      setCoursesLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const totalFees = formData.selectedCourseIds.reduce((sum, id) => {
    const course = courses.find(c => c.id === id);
    return sum + (course?.fee || 0);
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const studentData = {
        ...formData,
        courseIds: formData.selectedCourseIds,
        totalFees,
        pendingFees: totalFees,
        createdAt: new Date().toISOString(),
      };
      // Remove the temporary selectedCourseIds field
      delete (studentData as any).selectedCourseIds;

      await addDoc(collection(db, 'students'), studentData);
      alert('Student registered successfully!');
      setFormData({
        name: '',
        phone: '',
        address: '',
        parentPhone: '',
        grade: '',
        selectedCourseIds: [],
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'students');
    } finally {
      setLoading(false);
    }
  };

  const toggleCourse = (id: string) => {
    setFormData(prev => {
      const isSelected = prev.selectedCourseIds.includes(id);
      return {
        ...prev,
        selectedCourseIds: isSelected
          ? prev.selectedCourseIds.filter(cid => cid !== id)
          : [...prev.selectedCourseIds, id]
      };
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100 bg-slate-50/50">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <UserPlus className="w-6 h-6 text-blue-600" />
          Student Registration
        </h2>
      </div>
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Student ID/Name :</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Phone Number</label>
            <input
              type="tel"
              required
              value={formData.phone}
              onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Address</label>
            <input
              type="text"
              value={formData.address}
              onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Parent Phone</label>
            <input
              type="tel"
              value={formData.parentPhone}
              onChange={e => setFormData(prev => ({ ...prev, parentPhone: e.target.value }))}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Class/Grade</label>
            <select
              required
              value={formData.grade}
              onChange={e => setFormData(prev => ({ ...prev, grade: e.target.value }))}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none"
            >
              <option value="">Select Grade</option>
              {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700">Select Courses</label>
            {courses.length < 5 && !coursesLoading && user && (user.email === 'shabbir.bindulogic2@gmail.com' || user.email === 'admin@example.com') && (
              <button 
                type="button"
                onClick={() => {
                  const defaults = [
                    { name: 'Physics', fee: 2000 },
                    { name: 'Chemistry', fee: 2000 },
                    { name: 'H. Math', fee: 2000 },
                    { name: 'Biology', fee: 1500 },
                    { name: 'ICT', fee: 1500 },
                  ];
                  const missing = defaults.filter(d => !courses.some(c => c.name === d.name));
                  missing.forEach(async d => {
                    try {
                      await addDoc(collection(db, 'courses'), d);
                    } catch (e) {
                      console.error(e);
                    }
                  });
                }}
                className="text-[10px] font-bold text-blue-600 hover:underline"
              >
                Seed Missing Courses
              </button>
            )}
          </div>
          {coursesLoading ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading courses...
            </div>
          ) : coursesError ? (
            <div className="p-4 bg-rose-50 text-rose-600 rounded-xl text-sm border border-rose-100">
              {coursesError}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {courses.map(course => (
                <button
                  key={course.id}
                  type="button"
                  onClick={() => toggleCourse(course.id)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    formData.selectedCourseIds.includes(course.id)
                      ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-200'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-slate-900">{course.name}</div>
                      <div className="text-sm text-slate-500">৳{course.fee}</div>
                    </div>
                    {formData.selectedCourseIds.includes(course.id) && (
                      <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center shadow-sm">
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 bg-blue-50 rounded-xl flex items-center justify-between">
          <span className="font-bold text-blue-900">Total Calculated Fees:</span>
          <span className="text-2xl font-black text-blue-600">৳{totalFees}</span>
        </div>

        <button
          type="submit"
          disabled={loading || !formData.name || formData.selectedCourseIds.length === 0}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Register Student
        </button>
      </form>
    </div>
  );
}
