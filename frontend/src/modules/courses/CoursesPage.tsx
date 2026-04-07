import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { ROLE_HIERARCHY, type Role } from '@company-hub/shared';
import {
  GraduationCap, Plus, Play, CheckCircle, ArrowLeft, ChevronRight,
  BookOpen, Video, FileText, X,
} from 'lucide-react';

interface Course {
  id: string; title: string; description: string | null; thumbnailUrl: string | null;
  isPublished: boolean; sortOrder: number;
  modules?: CourseModule[];
}
interface CourseModule { id: string; title: string; description: string | null; sortOrder: number; lessons: Lesson[]; }
interface Lesson {
  id: string; title: string; contentType: string; textContent: string | null;
  videoUrl: string | null; videoDurationSeconds: number | null; sortOrder: number;
}
interface Enrollment {
  id: string; courseId: string; courseTitle: string; courseDescription: string | null;
  courseThumbnail: string | null; enrolledAt: string; completedAt: string | null;
}

export default function CoursesPage() {
  const { user } = useAuthStore();
  const isAdmin = ROLE_HIERARCHY[(user?.role as Role) || 'user'] >= ROLE_HIERARCHY.admin;
  const [activeCourse, setActiveCourse] = useState<string | null>(null);
  const [activeLesson, setActiveLesson] = useState<string | null>(null);

  if (activeLesson && activeCourse) {
    return <LessonPlayer lessonId={activeLesson} courseId={activeCourse} onBack={() => setActiveLesson(null)} />;
  }

  if (activeCourse) {
    return <CourseDetail courseId={activeCourse} onBack={() => setActiveCourse(null)} onOpenLesson={setActiveLesson} />;
  }

  return <CourseList onOpenCourse={setActiveCourse} isAdmin={isAdmin} />;
}

function CourseList({ onOpenCourse, isAdmin }: { onOpenCourse: (id: string) => void; isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: courses } = useQuery({
    queryKey: ['courses'],
    queryFn: () => apiGet<Course[]>('/courses'),
  });

  const { data: enrollments } = useQuery({
    queryKey: ['my-enrollments'],
    queryFn: () => apiGet<Enrollment[]>('/courses/my-enrollments'),
  });

  const enrolledIds = new Set(enrollments?.map(e => e.courseId) || []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Kurse</h2>
        {isAdmin && (
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus size={18} /> Kurs erstellen
          </button>
        )}
      </div>

      {/* My Enrollments */}
      {enrollments && enrollments.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Meine Kurse</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {enrollments.map((e) => (
              <button key={e.id} onClick={() => onOpenCourse(e.courseId)}
                className="card overflow-hidden text-left hover:shadow-elevated transition-shadow">
                <div className="h-32 bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  {e.courseThumbnail ? (
                    <img src={e.courseThumbnail} className="w-full h-full object-cover" />
                  ) : (
                    <GraduationCap size={36} className="text-white/80" />
                  )}
                </div>
                <div className="p-4">
                  <div className="font-medium text-slate-800">{e.courseTitle}</div>
                  {e.courseDescription && <p className="text-sm text-slate-500 mt-1 line-clamp-2">{e.courseDescription}</p>}
                  <CourseProgressBar courseId={e.courseId} />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* All Courses */}
      <div>
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
          {isAdmin ? 'Alle Kurse' : 'Verfügbare Kurse'}
        </h3>
        {!courses?.length ? (
          <div className="card p-12 text-center text-slate-400">Noch keine Kurse vorhanden.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.filter(c => !enrolledIds.has(c.id)).map((c) => (
              <button key={c.id} onClick={() => onOpenCourse(c.id)}
                className="card overflow-hidden text-left hover:shadow-elevated transition-shadow">
                <div className="h-32 bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center">
                  <GraduationCap size={36} className="text-white/80" />
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-slate-800">{c.title}</div>
                    {!c.isPublished && <span className="badge-warning text-[10px]">Entwurf</span>}
                  </div>
                  {c.description && <p className="text-sm text-slate-500 mt-1 line-clamp-2">{c.description}</p>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {showForm && <CreateCourseModal onClose={() => setShowForm(false)} />}
    </div>
  );
}

function CourseDetail({ courseId, onBack, onOpenLesson }: {
  courseId: string; onBack: () => void; onOpenLesson: (id: string) => void;
}) {
  const queryClient = useQueryClient();

  const { data: course } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => apiGet<Course>(`/courses/${courseId}`),
  });

  const enrollMutation = useMutation({
    mutationFn: () => apiPost(`/courses/${courseId}/enroll`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-enrollments'] }),
  });

  if (!course) return <div className="text-center py-12 text-slate-400">Laden...</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="btn-ghost p-2"><ArrowLeft size={18} /></button>
        <h2 className="text-lg font-semibold text-slate-800">{course.title}</h2>
      </div>

      {course.description && <p className="text-slate-500">{course.description}</p>}

      <button onClick={() => enrollMutation.mutate()} className="btn-primary">
        <BookOpen size={18} /> Kurs starten
      </button>

      {/* Modules & Lessons */}
      <div className="space-y-4">
        {course.modules?.map((mod, mi) => (
          <div key={mod.id} className="card">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">
                <span className="text-slate-400 mr-2">{mi + 1}.</span>{mod.title}
              </h3>
              {mod.description && <p className="text-sm text-slate-500 mt-1">{mod.description}</p>}
            </div>
            <div className="divide-y divide-slate-50">
              {mod.lessons.map((lesson, li) => (
                <button key={lesson.id} onClick={() => onOpenLesson(lesson.id)}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors text-left">
                  {lesson.contentType === 'video' ? (
                    <Video size={16} className="text-indigo-500 flex-shrink-0" />
                  ) : (
                    <FileText size={16} className="text-slate-400 flex-shrink-0" />
                  )}
                  <span className="text-sm text-slate-700 flex-1">{lesson.title}</span>
                  {lesson.videoDurationSeconds && (
                    <span className="text-xs text-slate-400">
                      {Math.floor(lesson.videoDurationSeconds / 60)} Min.
                    </span>
                  )}
                  <ChevronRight size={14} className="text-slate-300" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LessonPlayer({ lessonId, courseId, onBack }: { lessonId: string; courseId: string; onBack: () => void }) {
  const queryClient = useQueryClient();

  const { data: lesson } = useQuery({
    queryKey: ['lesson', lessonId],
    queryFn: () => apiGet<Lesson>(`/courses/lessons/${lessonId}`),
  });

  const completeMutation = useMutation({
    mutationFn: () => apiPost(`/courses/lessons/${lessonId}/progress`, { completed: true, progressPercent: 100 }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['course-progress'] }),
  });

  if (!lesson) return <div className="text-center py-12 text-slate-400">Laden...</div>;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="btn-ghost p-2"><ArrowLeft size={18} /></button>
        <h2 className="text-lg font-semibold text-slate-800">{lesson.title}</h2>
      </div>

      {/* Video */}
      {lesson.videoUrl && (
        <div className="card overflow-hidden">
          <div className="aspect-video bg-black">
            <video src={lesson.videoUrl} controls className="w-full h-full" />
          </div>
        </div>
      )}

      {/* Text content */}
      {lesson.textContent && (
        <div className="card p-6 prose prose-slate max-w-none">
          <div dangerouslySetInnerHTML={{ __html: lesson.textContent.replace(/\n/g, '<br/>') }} />
        </div>
      )}

      {/* Complete button */}
      <button onClick={() => completeMutation.mutate()} className="btn-primary">
        <CheckCircle size={18} />
        {completeMutation.isSuccess ? 'Erledigt!' : 'Als abgeschlossen markieren'}
      </button>
    </div>
  );
}

function CourseProgressBar({ courseId }: { courseId: string }) {
  const { data: progress } = useQuery({
    queryKey: ['course-progress', courseId],
    queryFn: () => apiGet<{ totalLessons: number; completedLessons: number; progressPercent: number }>(`/courses/${courseId}/progress`),
  });

  if (!progress) return null;

  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs text-slate-400 mb-1">
        <span>{progress.completedLessons}/{progress.totalLessons} Lektionen</span>
        <span>{progress.progressPercent}%</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${progress.progressPercent}%` }} />
      </div>
    </div>
  );
}

function CreateCourseModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ title: '', description: '' });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiPost('/courses', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['courses'] }); onClose(); },
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-800">Neuer Kurs</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4">
          <div>
            <label className="label">Titel</label>
            <input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="label">Beschreibung</label>
            <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary">Abbrechen</button>
            <button type="submit" className="btn-primary" disabled={createMutation.isPending}>Erstellen</button>
          </div>
        </form>
      </div>
    </div>
  );
}
