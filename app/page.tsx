"use client";

import {
  Activity, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Bell, Building2,
  CalendarDays, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, CircleHelp,
  ClipboardList, Clock3, Droplets, FileText, Filter, Hammer, ImagePlus, LayoutDashboard,
  Lightbulb, LogIn, LogOut, Menu, MessageSquareText, MoreHorizontal, Plus, Search,
  Settings2, ShieldCheck, SlidersHorizontal, Sparkles, Star, Users, Wrench, X,
  Zap, type LucideIcon,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

type Role = "admin" | "resident" | "technician";
type Screen = "overview" | "reports" | "team" | "analytics" | "settings";
type Status = "pending_verification" | "awaiting_technician" | "awaiting_confirmation" | "accepted" | "in_progress" | "waiting_parts" | "completed";
type Priority = "low" | "normal" | "high" | "urgent";
type Category = "Kelistrikan" | "Peralatan elektronik" | "Perpipaan & air" | "Furniture" | "Bangunan & fasilitas umum" | "Lainnya";

type TimelineItem = { status: Status; note: string; at: string; actor?: string };
type Report = {
  id: string; code: string; item: string; category: Category; building: string; room: string;
  description: string; status: Status; priority: Priority; resident: string; residentId: string;
  technician: string; technicianId: string; createdAt: string; photoUrl: string; afterPhotoUrl: string;
  timeline: TimelineItem[]; rating?: number; review?: string; estimatedHours?: number;
};
type Tech = { id: string; name: string; title: string; skills: Category[]; available: boolean; initials: string; rating: number; jobs: number };
type Notice = { id: string; text: string; at: string; read: boolean };

const statusLabels: Record<Status, string> = {
  pending_verification: "Menunggu verifikasi", awaiting_technician: "Menunggu teknisi",
  awaiting_confirmation: "Menunggu konfirmasi", accepted: "Teknisi menerima", in_progress: "Sedang diperbaiki",
  waiting_parts: "Menunggu suku cadang", completed: "Selesai",
};
const statusTone: Record<Status, string> = {
  pending_verification: "muted", awaiting_technician: "amber", awaiting_confirmation: "violet",
  accepted: "blue", in_progress: "red", waiting_parts: "amber", completed: "green",
};
const categories: { label: Category; icon: LucideIcon }[] = [
  { label: "Kelistrikan", icon: Zap }, { label: "Peralatan elektronik", icon: Activity },
  { label: "Perpipaan & air", icon: Droplets }, { label: "Furniture", icon: Building2 },
  { label: "Bangunan & fasilitas umum", icon: Hammer }, { label: "Lainnya", icon: Settings2 },
];
const priorityLabels: Record<Priority, string> = { low: "Rendah", normal: "Normal", high: "Tinggi", urgent: "Darurat" };
const demoTechs: Tech[] = [
  { id: "tech-1", name: "Bima Saputra", title: "Teknisi kelistrikan", skills: ["Kelistrikan", "Peralatan elektronik"], available: true, initials: "BS", rating: 4.9, jobs: 28 },
  { id: "tech-2", name: "Rizky Maulana", title: "Teknisi perpipaan", skills: ["Perpipaan & air", "Bangunan & fasilitas umum"], available: true, initials: "RM", rating: 4.8, jobs: 36 },
  { id: "tech-3", name: "Siti Rahma", title: "Teknisi umum", skills: ["Furniture", "Bangunan & fasilitas umum", "Lainnya"], available: false, initials: "SR", rating: 4.9, jobs: 21 },
  { id: "tech-4", name: "Andi Pratama", title: "Teknisi elektronik", skills: ["Peralatan elektronik", "Kelistrikan"], available: true, initials: "AP", rating: 4.7, jobs: 19 },
];
const initialReports: Report[] = [
  { id: "r-101", code: "FD-2408", item: "Lampu koridor mati", category: "Kelistrikan", building: "Gedung Asoka", room: "Lt. 3 · Koridor timur", description: "Dua lampu di depan kamar 312 mati sejak tadi malam.", status: "in_progress", priority: "high", resident: "Alya Pratama", residentId: "resident-1", technician: "Bima Saputra", technicianId: "tech-1", createdAt: "2026-11-02T02:30:00.000Z", photoUrl: "", afterPhotoUrl: "", timeline: [{ status: "pending_verification", note: "Laporan dibuat oleh penghuni.", at: "2026-11-02T02:30:00.000Z", actor: "Alya Pratama" }, { status: "awaiting_technician", note: "Laporan diverifikasi oleh helpdesk.", at: "2026-11-02T03:00:00.000Z", actor: "Nanda Putri" }, { status: "in_progress", note: "Bima mulai memeriksa instalasi lampu.", at: "2026-11-02T04:00:00.000Z", actor: "Bima Saputra" }] },
  { id: "r-102", code: "FD-2407", item: "Keran wastafel bocor", category: "Perpipaan & air", building: "Gedung Cendana", room: "Lt. 2 · Kamar 208", description: "Air terus menetes meskipun keran sudah ditutup.", status: "awaiting_confirmation", priority: "normal", resident: "Dinda Lestari", residentId: "resident-2", technician: "Rizky Maulana", technicianId: "tech-2", createdAt: "2026-11-02T01:05:00.000Z", photoUrl: "", afterPhotoUrl: "", timeline: [{ status: "pending_verification", note: "Laporan dibuat oleh penghuni.", at: "2026-11-02T01:05:00.000Z", actor: "Dinda Lestari" }, { status: "awaiting_confirmation", note: "Helpdesk menawarkan pekerjaan kepada Rizky.", at: "2026-11-02T01:30:00.000Z", actor: "Nanda Putri" }] },
  { id: "r-103", code: "FD-2406", item: "Stop kontak longgar", category: "Kelistrikan", building: "Gedung Asoka", room: "Lt. 1 · Kamar 106", description: "Stop kontak terlepas dari dinding dan terasa panas.", status: "pending_verification", priority: "urgent", resident: "Alya Pratama", residentId: "resident-1", technician: "", technicianId: "", createdAt: "2026-11-02T00:20:00.000Z", photoUrl: "", afterPhotoUrl: "", timeline: [{ status: "pending_verification", note: "Laporan dibuat oleh penghuni.", at: "2026-11-02T00:20:00.000Z", actor: "Alya Pratama" }] },
  { id: "r-104", code: "FD-2405", item: "Kaki meja belajar patah", category: "Furniture", building: "Gedung Cendana", room: "Lt. 4 · Kamar 417", description: "Satu kaki meja patah saat digunakan.", status: "completed", priority: "low", resident: "Alya Pratama", residentId: "resident-1", technician: "Siti Rahma", technicianId: "tech-3", createdAt: "2026-11-01T06:25:00.000Z", photoUrl: "", afterPhotoUrl: "", timeline: [{ status: "pending_verification", note: "Laporan dibuat oleh penghuni.", at: "2026-11-01T06:25:00.000Z", actor: "Alya Pratama" }, { status: "completed", note: "Kaki meja diperkuat dan sudah siap digunakan.", at: "2026-11-01T09:00:00.000Z", actor: "Siti Rahma" }], rating: 5, review: "Cepat dan rapi, terima kasih." },
  { id: "r-105", code: "FD-2404", item: "Dispenser tidak panas", category: "Peralatan elektronik", building: "Gedung Anggrek", room: "Lt. 2 · Pantry", description: "Air panas tidak keluar sejak kemarin.", status: "awaiting_technician", priority: "normal", resident: "Fajar Hidayat", residentId: "resident-3", technician: "", technicianId: "", createdAt: "2026-11-01T04:10:00.000Z", photoUrl: "", afterPhotoUrl: "", timeline: [{ status: "pending_verification", note: "Laporan dibuat oleh penghuni.", at: "2026-11-01T04:10:00.000Z", actor: "Fajar Hidayat" }, { status: "awaiting_technician", note: "Laporan sudah diverifikasi.", at: "2026-11-01T05:00:00.000Z", actor: "Nanda Putri" }] },
];

function StatusPill({ status }: { status: Status }) { return <span className={`status-pill ${statusTone[status]}`}><i />{statusLabels[status]}</span>; }
function PriorityPill({ priority }: { priority: Priority }) { return <span className={`priority-pill ${priority}`}><i />{priorityLabels[priority]}</span>; }
function initials(name: string) { return name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase(); }
function formatDate(value: string) { return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)); }
function formatShort(value: string) { return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(new Date(value)); }
function initialsColor(name: string) { const colors = ["avatar-coral", "avatar-blue", "avatar-lilac", "avatar-green", "avatar-gold"]; return colors[name.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % colors.length]; }
function safeLocalRead<T>(key: string, fallback: T): T { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; } }
function escapeFileName(name: string) { return name.replace(/[^a-zA-Z0-9._-]/g, "-"); }

function readFile(file: File): Promise<string> { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Foto tidak dapat dibaca.")); reader.readAsDataURL(file); }); }

function Modal({ title, subtitle, onClose, children, wide = false }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className={`modal-card ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}><header className="modal-header"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button" aria-label="Tutup" onClick={onClose}><X size={19} /></button></header>{children}</section></div>;
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("overview");
  const [role, setRole] = useState<Role>("admin");
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [profileName, setProfileName] = useState("Nanda Putri");
  const [authReady, setAuthReady] = useState(!hasSupabaseConfig);
  const [reports, setReports] = useState<Report[]>([]);
  const [techs, setTechs] = useState<Tech[]>(demoTechs);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [showReportForm, setShowReportForm] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [showNotices, setShowNotices] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [busyReport, setBusyReport] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [reportForm, setReportForm] = useState({ item: "", category: "Kelistrikan" as Category, building: "", room: "", description: "", photo: null as File | null });
  const [completionFile, setCompletionFile] = useState<File | null>(null);
  const [reviewStars, setReviewStars] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [estimateDraft, setEstimateDraft] = useState("");
  const [workNote, setWorkNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const completionFileRef = useRef<HTMLInputElement>(null);

  const demo = !hasSupabaseConfig;
  const currentName = demo ? (role === "admin" ? "Nanda Putri" : role === "resident" ? "Alya Pratama" : "Bima Saputra") : profileName;
  const roleTitle = role === "admin" ? "Helpdesk" : role === "resident" ? "Penghuni" : "Teknisi";
  const selectedReport = reports.find((report) => report.id === selectedId) ?? null;

  const loadCloudData = useCallback(async (userId: string) => {
    if (!supabase) return;
    const [{ data: profile }, { data: rawReports }, { data: staff }, { data: skills }, { data: techRecords }, { data: rawNotices }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, role").eq("id", userId).maybeSingle(),
      supabase.from("reports").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name, role"),
      supabase.from("technician_skills").select("technician_id, category"),
      supabase.from("technicians").select("user_id, availability, jobs_completed, rating"),
      supabase.from("notifications").select("id, message, created_at, is_read").order("created_at", { ascending: false }).limit(8),
    ]);
    if (profile) {
      setProfileName(profile.full_name || sessionUser?.email?.split("@")[0] || "Pengguna");
      setRole((profile.role as Role) || "resident");
    }
    const people = new Map((staff ?? []).map((person) => [person.id, person.full_name || "Pengguna"]));
    const mapped: Report[] = await Promise.all((rawReports ?? []).map(async (row: Record<string, unknown>) => {
      const photoPath = String(row.photo_path ?? "");
      const afterPath = String(row.completion_photo_path ?? "");
      const signed = async (path: string) => {
        if (!path) return "";
        const { data } = await supabase!.storage.from("fixdorm-media").createSignedUrl(path, 3600);
        return data?.signedUrl ?? "";
      };
      return {
        id: String(row.id), code: `FD-${String(row.id).replaceAll("-", "").slice(0, 6).toUpperCase()}`,
        item: String(row.item_name), category: row.category as Category, building: String(row.building), room: String(row.room),
        description: String(row.description), status: row.status as Status, priority: row.priority as Priority,
        residentId: String(row.reporter_id), resident: people.get(String(row.reporter_id)) || "Penghuni",
        technicianId: String(row.technician_id ?? ""), technician: people.get(String(row.technician_id ?? "")) || "",
        createdAt: String(row.created_at), photoUrl: await signed(photoPath), afterPhotoUrl: await signed(afterPath),
        timeline: [], rating: row.rating ? Number(row.rating) : undefined, review: String(row.review ?? "") || undefined,
        estimatedHours: row.estimated_hours ? Number(row.estimated_hours) : undefined,
      };
    }));
    setReports(mapped);
    const techMap = new Map((techRecords ?? []).map((tech) => [tech.user_id, tech]));
    const grouped = new Map<string, Category[]>();
    for (const skill of skills ?? []) grouped.set(skill.technician_id, [...(grouped.get(skill.technician_id) ?? []), skill.category as Category]);
    setTechs((staff ?? []).filter((person) => person.role === "technician").map((person) => {
      const record = techMap.get(person.id);
      return { id: person.id, name: person.full_name || "Teknisi", title: (grouped.get(person.id) ?? ["Lainnya"]).join(" · "), skills: grouped.get(person.id) ?? ["Lainnya"], available: record?.availability === "available", initials: initials(person.full_name || "T"), rating: Number(record?.rating ?? 5), jobs: Number(record?.jobs_completed ?? 0) };
    }));
    setNotices((rawNotices ?? []).map((notice) => ({ id: String(notice.id), text: String(notice.message), at: String(notice.created_at), read: Boolean(notice.is_read) })));
  }, [sessionUser?.email]);

  useEffect(() => {
    if (!supabase) {
      const saved = safeLocalRead<Report[] | null>("fixdorm:reports", null);
      setReports(saved ?? initialReports);
      setNotices(safeLocalRead<Notice[]>("fixdorm:notices", [
        { id: "n-1", text: "Laporan stop kontak membutuhkan verifikasi segera.", at: new Date().toISOString(), read: false },
        { id: "n-2", text: "Bima mulai memperbaiki lampu koridor Gedung Asoka.", at: new Date(Date.now() - 3600000).toISOString(), read: false },
      ]));
      setAuthReady(true);
      return;
    }
    let alive = true;
    void supabase.auth.getSession().then(({ data }) => { if (alive) { setSessionUser(data.session?.user ?? null); setAuthReady(true); } });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { setSessionUser(session?.user ?? null); });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!supabase || !sessionUser) return;
    void loadCloudData(sessionUser.id);
    const channel = supabase.channel(`fixdorm-${sessionUser.id}`).on("postgres_changes", { event: "*", schema: "public", table: "reports" }, () => { void loadCloudData(sessionUser.id); }).on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${sessionUser.id}` }, () => { void loadCloudData(sessionUser.id); }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [sessionUser, loadCloudData]);

  useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(""), 3200); return () => clearTimeout(timer); } }, [toast]);

  const visibleReports = useMemo(() => reports.filter((report) => {
    if (role === "resident" && !demo && report.residentId !== sessionUser?.id) return false;
    if (role === "resident" && demo && report.residentId !== "resident-1") return false;
    if (role === "technician" && report.technicianId !== (demo ? "tech-1" : sessionUser?.id)) return false;
    if (filter !== "all" && report.status !== filter) return false;
    const text = `${report.code} ${report.item} ${report.category} ${report.building} ${report.room} ${report.resident}`.toLowerCase();
    return text.includes(query.toLowerCase());
  }), [reports, role, demo, sessionUser?.id, filter, query]);

  const unread = notices.filter((notice) => !notice.read).length;
  const metrics = useMemo(() => ({
    total: visibleReports.length,
    active: visibleReports.filter((report) => ["accepted", "in_progress", "waiting_parts"].includes(report.status)).length,
    waiting: visibleReports.filter((report) => ["pending_verification", "awaiting_technician", "awaiting_confirmation"].includes(report.status)).length,
    done: visibleReports.filter((report) => report.status === "completed").length,
  }), [visibleReports]);

  function persistDemo(next: Report[]) { setReports(next); localStorage.setItem("fixdorm:reports", JSON.stringify(next)); }
  function addNotice(text: string) {
    const next = [{ id: crypto.randomUUID(), text, at: new Date().toISOString(), read: false }, ...notices].slice(0, 12);
    setNotices(next); if (demo) localStorage.setItem("fixdorm:notices", JSON.stringify(next));
  }
  async function addEvent(report: Report, status: Status, note: string) {
    if (supabase && sessionUser) {
      const { error } = await supabase.from("report_events").insert({ report_id: report.id, actor_id: sessionUser.id, from_status: report.status, to_status: status, note });
      if (error) throw error;
    }
    return { status, note, at: new Date().toISOString(), actor: currentName } as TimelineItem;
  }
  async function updateReport(id: string, changes: Partial<Report>, note: string) {
    const old = reports.find((report) => report.id === id); if (!old) return;
    const nextStatus = changes.status ?? old.status;
    const nextTechId = changes.technicianId === undefined ? old.technicianId : changes.technicianId;
    const nextTechName = changes.technician === undefined ? old.technician : changes.technician;
    setBusyReport(true);
    try {
      if (supabase && sessionUser) {
        const dbChanges: Record<string, unknown> = {};
        if (changes.status) dbChanges.status = changes.status;
        if (changes.priority) dbChanges.priority = changes.priority;
        if (changes.estimatedHours !== undefined) dbChanges.estimated_hours = changes.estimatedHours;
        if (changes.technicianId !== undefined) dbChanges.technician_id = changes.technicianId || null;
        if (changes.afterPhotoUrl) dbChanges.completion_photo_path = changes.afterPhotoUrl;
        const { error } = await supabase.from("reports").update(dbChanges).eq("id", id);
        if (error) throw error;
        if (changes.technicianId) {
          const { error: assignmentError } = await supabase.from("job_assignments").upsert({ report_id: id, technician_id: changes.technicianId, status: "offered", offered_by: sessionUser.id, offered_at: new Date().toISOString() }, { onConflict: "report_id,technician_id" });
          if (assignmentError) throw assignmentError;
        }
        if (role === "technician" && changes.status === "awaiting_technician") await supabase.from("job_assignments").update({ status: "declined", responded_at: new Date().toISOString() }).eq("report_id", id).eq("technician_id", sessionUser.id);
        if (role === "technician" && changes.status === "accepted") await supabase.from("job_assignments").update({ status: "accepted", responded_at: new Date().toISOString() }).eq("report_id", id).eq("technician_id", sessionUser.id);
        if (role === "technician" && changes.status === "completed") await supabase.from("job_assignments").update({ status: "completed", responded_at: new Date().toISOString() }).eq("report_id", id).eq("technician_id", sessionUser.id);
        await addEvent(old, nextStatus, note);
        await loadCloudData(sessionUser.id);
      } else {
        const event = { status: nextStatus, note, at: new Date().toISOString(), actor: currentName };
        const next = reports.map((report) => report.id === id ? { ...report, ...changes, status: nextStatus, technicianId: nextTechId, technician: nextTechName, updatedAt: event.at, timeline: [...report.timeline, event] } : report);
        persistDemo(next);
        addNotice(`${old.code}: ${note}`);
      }
      setToast("Perubahan laporan berhasil disimpan.");
    } catch (error) { setToast(error instanceof Error ? error.message : "Perubahan belum dapat disimpan."); }
    finally { setBusyReport(false); }
  }

  async function handleCreateReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!reportForm.item.trim() || !reportForm.building.trim() || !reportForm.room.trim() || !reportForm.description.trim()) return;
    setBusyReport(true);
    try {
      const id = crypto.randomUUID(); const createdAt = new Date().toISOString(); const file = reportForm.photo;
      if (file && file.size > 8 * 1024 * 1024) throw new Error("Ukuran foto maksimal 8 MB.");
      if (supabase && sessionUser) {
        const { error } = await supabase.from("reports").insert({ id, reporter_id: sessionUser.id, item_name: reportForm.item.trim(), category: reportForm.category, building: reportForm.building.trim(), room: reportForm.room.trim(), description: reportForm.description.trim(), status: "pending_verification", priority: "normal" });
        if (error) throw error;
        let photoPath = "";
        if (file) {
          photoPath = `${id}/${Date.now()}-${escapeFileName(file.name)}`;
          const { error: uploadError } = await supabase.storage.from("fixdorm-media").upload(photoPath, file, { contentType: file.type, upsert: true });
          if (uploadError) throw uploadError;
          const { error: photoRowError } = await supabase.from("reports").update({ photo_path: photoPath }).eq("id", id);
          if (photoRowError) throw photoRowError;
        }
        const { error: eventError } = await supabase.from("report_events").insert({ report_id: id, actor_id: sessionUser.id, to_status: "pending_verification", note: "Laporan kerusakan dibuat." });
        if (eventError) throw eventError;
        await loadCloudData(sessionUser.id);
      } else {
        const photoUrl = file ? await readFile(file) : "";
        const report: Report = { id, code: `FD-${id.replaceAll("-", "").slice(0, 6).toUpperCase()}`, item: reportForm.item.trim(), category: reportForm.category, building: reportForm.building.trim(), room: reportForm.room.trim(), description: reportForm.description.trim(), status: "pending_verification", priority: "normal", resident: currentName, residentId: "resident-1", technician: "", technicianId: "", createdAt, photoUrl, afterPhotoUrl: "", timeline: [{ status: "pending_verification", note: "Laporan kerusakan dibuat.", at: createdAt, actor: currentName }] };
        persistDemo([report, ...reports]); addNotice(`Laporan baru ${report.code} menunggu verifikasi helpdesk.`);
      }
      setShowReportForm(false); setReportForm({ item: "", category: "Kelistrikan", building: "", room: "", description: "", photo: null }); setScreen("reports"); setFilter("all"); setToast("Laporan berhasil dibuat.");
    } catch (error) { setToast(error instanceof Error ? error.message : "Laporan belum dapat disimpan."); }
    finally { setBusyReport(false); }
  }

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!supabase) { setShowAuth(false); return; }
    setAuthBusy(true);
    try {
      if (authMode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password }); if (error) throw error;
        setShowAuth(false); setToast("Berhasil masuk ke FixDorm.");
      } else {
        const { error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: fullName.trim() } } }); if (error) throw error;
        setShowAuth(false); setToast("Akun dibuat. Cek email untuk verifikasi jika diminta.");
      }
    } catch (error) { setToast(error instanceof Error ? error.message : "Autentikasi gagal."); }
    finally { setAuthBusy(false); }
  }

  async function logout() {
    if (supabase) await supabase.auth.signOut();
    setSessionUser(null); if (demo) setShowAuth(true);
  }

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selectedReport) return;
    if (supabase && sessionUser) {
      const { error } = await supabase.from("reviews").upsert({ report_id: selectedReport.id, resident_id: sessionUser.id, technician_id: selectedReport.technicianId, rating: reviewStars, comment: reviewText.trim() }, { onConflict: "report_id,resident_id" });
      if (error) { setToast(error.message); return; }
      await loadCloudData(sessionUser.id);
    } else {
      persistDemo(reports.map((report) => report.id === selectedReport.id ? { ...report, rating: reviewStars, review: reviewText.trim() } : report));
    }
    setToast("Terima kasih atas penilaian Anda."); setReviewText("");
  }

  async function openReport(id: string) {
    setSelectedId(id);
    const report = reports.find((item) => item.id === id);
    setEstimateDraft(report?.estimatedHours ? String(report.estimatedHours) : ""); setWorkNote("");
    if (!supabase) return;
    const { data, error } = await supabase.from("report_events").select("id, actor_id, to_status, note, created_at").eq("report_id", id).order("created_at", { ascending: true });
    if (error || !data) return;
    const { data: people } = await supabase.from("profiles").select("id, full_name");
    const names = new Map((people ?? []).map((person) => [person.id, person.full_name || "FixDorm"]));
    setReports((current) => current.map((report) => report.id === id ? { ...report, timeline: data.map((item) => ({ status: item.to_status as Status, note: item.note, at: item.created_at, actor: names.get(item.actor_id ?? "") ?? "FixDorm" })) } : report));
  }

  function changeScreen(next: Screen) { setScreen(next); setMobileNav(false); setFilter("all"); }

  if (!authReady) return <div className="loading-screen"><div className="brand-mark"><Wrench size={19} /></div><span>Menyiapkan FixDorm...</span></div>;
  if (hasSupabaseConfig && !sessionUser) return <main className="login-page"><div className="login-brand"><div className="brand-mark"><Wrench size={20} /></div><span>fix<span>dorm</span></span></div><div className="login-content"><span className="eyebrow"><span className="live-dot" /> RUANG ASRAMA, TERAWAT</span><h1>Perbaikan yang terasa <em>lebih mudah.</em></h1><p>Laporkan fasilitas rusak dan pantau perbaikannya, dari mana saja.</p><button className="button button-primary login-button" onClick={() => { setAuthMode("signin"); setShowAuth(true); }}><LogIn size={17} /> Masuk ke FixDorm <ArrowRight size={17} /></button><div className="login-foot"><ShieldCheck size={15} /> Akses aman khusus penghuni dan tim asrama</div></div><div className="login-illustration"><div className="illustration-card"><div className="illustration-card-head"><span><span className="live-dot" /> Semua berjalan lancar</span><span>Hari ini</span></div><div className="mini-stats"><div><span>Laporan aktif</span><strong>08</strong></div><div><span>Selesai bulan ini</span><strong>94<span className="mini-percent"> +12%</span></strong></div></div><div className="mini-chart"><i style={{ height: "34%" }} /><i style={{ height: "52%" }} /><i style={{ height: "45%" }} /><i style={{ height: "70%" }} /><i style={{ height: "57%" }} /><i style={{ height: "83%" }} /><i style={{ height: "67%" }} /><i style={{ height: "93%" }} /></div><div className="illustration-task"><span className="task-icon"><Zap size={17} /></span><span><strong>Lampu koridor Gedung Asoka</strong><small>Teknisi sedang memperbaiki</small></span><span className="status-pill red"><i />Dalam proses</span></div></div></div><div className="login-watermark">Fasilitas baik, hari lebih nyaman.</div>{showAuth && <AuthModal authMode={authMode} setAuthMode={setAuthMode} email={email} setEmail={setEmail} password={password} setPassword={setPassword} fullName={fullName} setFullName={setFullName} busy={authBusy} onClose={() => setShowAuth(false)} onSubmit={handleAuth} />}</main>;

  const roleNav: { screen: Screen; label: string; icon: LucideIcon }[] = role === "resident"
    ? [{ screen: "overview", label: "Ringkasan", icon: LayoutDashboard }, { screen: "reports", label: "Laporan saya", icon: ClipboardList }]
    : role === "technician"
      ? [{ screen: "overview", label: "Ringkasan", icon: LayoutDashboard }, { screen: "reports", label: "Pekerjaan", icon: Wrench }]
      : [{ screen: "overview", label: "Ringkasan", icon: LayoutDashboard }, { screen: "reports", label: "Semua laporan", icon: ClipboardList }, { screen: "team", label: "Tim teknisi", icon: Users }, { screen: "analytics", label: "Analitik", icon: Activity }];

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
      <div className="brand-row"><div className="brand-mark"><Wrench size={18} /></div><div className="brand-name">fix<span>dorm</span></div><button className="icon-button close-nav" aria-label="Tutup menu" onClick={() => setMobileNav(false)}><X size={18} /></button></div>
      <div className="workspace-label">ASRAMA TELKOM</div>
      <button className="residence-switch"><div className="residence-icon"><Building2 size={16} /></div><span><strong>Telkom Residence</strong><small>Bandung, Indonesia</small></span><ChevronDown size={15} /></button>
      <div className="nav-caption">MENU UTAMA</div><nav className="main-nav">{roleNav.map((item) => { const Icon = item.icon; return <button key={item.screen} className={`nav-link ${screen === item.screen ? "nav-active" : ""}`} onClick={() => changeScreen(item.screen)}><Icon size={18} /><span>{item.label}</span>{item.screen === "reports" && role !== "resident" && <span className="nav-count">{metrics.waiting}</span>}</button>; })}</nav>
      {role === "admin" && <><div className="nav-caption second-caption">KELOLA</div><button className={`nav-link ${screen === "settings" ? "nav-active" : ""}`} onClick={() => changeScreen("settings")}><Settings2 size={18} /><span>Pengaturan</span></button></>}
      {role === "resident" && <div className="sidebar-help"><span className="help-icon"><CircleHelp size={18} /></span><div><strong>Butuh bantuan?</strong><p>Tim asrama siap membantu Anda.</p><button onClick={() => setToast("Hubungi helpdesk asrama di pos layanan utama.")}>Hubungi helpdesk <ArrowRight size={14} /></button></div></div>}
      <div className="sidebar-bottom"><div className="help-small"><CircleHelp size={16} /><span>Pusat bantuan</span><ArrowUpRight size={14} /></div><button className="profile-row" onClick={() => setShowRoleMenu((open) => !open)}><span className={`avatar ${initialsColor(currentName)}`}>{initials(currentName)}</span><span className="profile-text"><strong>{currentName}</strong><small>{roleTitle}</small></span><MoreHorizontal size={19} /></button></div>
    </aside>
    {mobileNav && <button className="nav-scrim" aria-label="Tutup menu" onClick={() => setMobileNav(false)} />}
    <div className="main-column">
      <header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu" aria-label="Buka menu" onClick={() => setMobileNav(true)}><Menu size={20} /></button><div className="breadcrumb">FixDorm <ChevronRight size={14} /> <strong>{roleNav.find((item) => item.screen === screen)?.label ?? "Pengaturan"}</strong></div></div><div className="topbar-right"><label className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari laporan..." /><kbd>⌘ K</kbd></label><div className="topbar-divider" /><button className={`icon-button notification-button ${showNotices ? "icon-selected" : ""}`} aria-label="Notifikasi" onClick={() => { setShowNotices((open) => !open); setShowRoleMenu(false); }}><Bell size={18} />{unread > 0 && <i className="notification-dot" />}</button><button className="header-user" onClick={() => { setShowRoleMenu((open) => !open); setShowNotices(false); }}><span className={`avatar avatar-small ${initialsColor(currentName)}`}>{initials(currentName)}</span><ChevronDown size={14} /></button></div></header>
      {showRoleMenu && <div className="floating-menu role-menu"><div className="menu-heading">AKUN SAYA</div><div className="menu-current"><span className={`avatar ${initialsColor(currentName)}`}>{initials(currentName)}</span><div><strong>{currentName}</strong><small>{demo ? "Mode demo · Data di perangkat" : sessionUser?.email}</small></div></div>{demo && <><div className="menu-heading role-switch-heading">LIHAT SEBAGAI</div>{([ ["admin", "Helpdesk", "Nanda Putri"], ["resident", "Penghuni", "Alya Pratama"], ["technician", "Teknisi", "Bima Saputra"] ] as const).map(([value, label]) => <button key={value} className={`role-choice ${role === value ? "role-choice-active" : ""}`} onClick={() => { setRole(value); setScreen("overview"); setShowRoleMenu(false); }}><span>{label}</span>{role === value && <Check size={15} />}</button>)}</>}{!demo && <button className="role-choice" onClick={() => void logout()}><LogOut size={15} /> Keluar</button>}<button className="connect-link" onClick={() => { setShowRoleMenu(false); changeScreen("settings"); }}>{demo ? <><Settings2 size={15} /> Pengaturan koneksi</> : <><Settings2 size={15} /> Pengaturan akun</>}</button></div>}
      {showNotices && <div className="floating-menu notices-menu"><div className="notices-title"><div><strong>Notifikasi</strong><small>{unread ? `${unread} belum dibaca` : "Semua sudah terbaca"}</small></div><button className="text-button" onClick={() => { const next = notices.map((notice) => ({ ...notice, read: true })); setNotices(next); if (demo) localStorage.setItem("fixdorm:notices", JSON.stringify(next)); else if (supabase && sessionUser) void supabase.from("notifications").update({ is_read: true }).eq("user_id", sessionUser.id); }}>Tandai dibaca</button></div>{notices.length ? notices.slice(0, 5).map((notice) => <div className={`notice-item ${notice.read ? "notice-read" : ""}`} key={notice.id}><span className="notice-icon"><Bell size={15} /></span><div><p>{notice.text}</p><small>{formatDate(notice.at)}</small></div>{!notice.read && <i />}</div>) : <div className="notice-empty">Belum ada notifikasi</div>}</div>}

      <main className="page-content">
        {demo && <button className="demo-banner" onClick={() => changeScreen("settings")}><Sparkles size={15} /><span><strong>Mode pratinjau</strong> · Hubungkan Supabase untuk autentikasi dan menyimpan data secara online.</span><ArrowRight size={15} /></button>}
        {screen === "overview" && <Overview role={role} name={currentName} reports={visibleReports} metrics={metrics} onCreate={() => setShowReportForm(true)} onOpen={openReport} onNavigate={() => changeScreen("reports")} />}
        {screen === "reports" && <ReportsPage role={role} reports={visibleReports} query={query} filter={filter} setFilter={setFilter} onCreate={() => setShowReportForm(true)} onOpen={openReport} onQuickUpdate={updateReport} />}
        {screen === "team" && <TeamPage techs={techs} reports={reports} onAssign={(report) => void openReport(report.id)} />}
        {screen === "analytics" && <AnalyticsPage reports={reports} />}
        {screen === "settings" && <SettingsPage demo={demo} name={currentName} email={sessionUser?.email ?? ""} onSignOut={() => void logout()} />}
      </main>
      <footer className="app-footer"><span>© 2026 FixDorm</span><span><span className="live-dot" /> Semua sistem beroperasi</span><button onClick={() => setToast("FixDorm · Layanan pengelolaan fasilitas asrama.")}>Bantuan & dukungan</button></footer>
    </div>

    {showReportForm && <Modal title="Buat laporan baru" subtitle="Ceritakan fasilitas yang perlu diperbaiki." onClose={() => setShowReportForm(false)} wide><form className="form-body" onSubmit={handleCreateReport}><div className="form-grid"><label className="field full-field"><span>Nama fasilitas <b>*</b></span><input autoFocus value={reportForm.item} onChange={(event) => setReportForm({ ...reportForm, item: event.target.value })} placeholder="Contoh: lampu kamar mandi" required maxLength={100} /></label><label className="field"><span>Kategori kerusakan <b>*</b></span><select value={reportForm.category} onChange={(event) => setReportForm({ ...reportForm, category: event.target.value as Category })}>{categories.map((item) => <option key={item.label}>{item.label}</option>)}</select></label><label className="field"><span>Gedung <b>*</b></span><input value={reportForm.building} onChange={(event) => setReportForm({ ...reportForm, building: event.target.value })} placeholder="Contoh: Gedung Asoka" required maxLength={80} /></label><label className="field full-field"><span>Lantai dan nomor ruangan <b>*</b></span><input value={reportForm.room} onChange={(event) => setReportForm({ ...reportForm, room: event.target.value })} placeholder="Contoh: Lantai 3 · Kamar 312" required maxLength={100} /></label><label className="field full-field"><span>Deskripsi masalah <b>*</b></span><textarea value={reportForm.description} onChange={(event) => setReportForm({ ...reportForm, description: event.target.value })} placeholder="Jelaskan kapan kerusakan terjadi dan apa yang Anda lihat..." required rows={4} maxLength={1000} /></label></div><div className="upload-row"><input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => setReportForm({ ...reportForm, photo: event.target.files?.[0] ?? null })} /><button type="button" className="upload-box" onClick={() => fileRef.current?.click()}><span className="upload-icon"><ImagePlus size={20} /></span><span><strong>{reportForm.photo ? reportForm.photo.name : "Tambahkan foto kerusakan"}</strong><small>PNG, JPG atau WEBP · Maks. 8 MB</small></span><span className="upload-select">Pilih foto</span></button></div><div className="form-note"><ShieldCheck size={15} /> Laporan Anda hanya dapat dilihat oleh tim pengelola asrama.</div><div className="modal-actions"><button type="button" className="button button-light" onClick={() => setShowReportForm(false)}>Batal</button><button className="button button-primary" disabled={busyReport}>{busyReport ? <span className="spinner" /> : <Plus size={17} />} Kirim laporan</button></div></form></Modal>}

    {selectedReport && <Modal title={selectedReport.item} subtitle={`${selectedReport.code} · Dilaporkan ${formatDate(selectedReport.createdAt)}`} onClose={() => { setSelectedId(null); setCompletionFile(null); }} wide><div className="report-detail"><div className="detail-main"><div className="detail-pills"><StatusPill status={selectedReport.status} /><PriorityPill priority={selectedReport.priority} /></div><p className="detail-description">{selectedReport.description}</p><div className="detail-facts"><div><Building2 size={17} /><span><small>Lokasi</small><strong>{selectedReport.building}</strong></span></div><div><span className="fact-room">⌂</span><span><small>Ruangan</small><strong>{selectedReport.room}</strong></span></div><div><span className="fact-category"><Wrench size={15} /></span><span><small>Kategori</small><strong>{selectedReport.category}</strong></span></div></div>{selectedReport.photoUrl && <div className="report-photo"><span>Foto kerusakan</span><img src={selectedReport.photoUrl} alt={`Foto ${selectedReport.item}`} /></div>}{selectedReport.afterPhotoUrl && <div className="report-photo"><span>Foto setelah perbaikan</span><img src={selectedReport.afterPhotoUrl} alt={`Hasil perbaikan ${selectedReport.item}`} /></div>}
        <div className="timeline-section"><h3>Perkembangan laporan</h3>{selectedReport.timeline.length ? <div className="timeline">{selectedReport.timeline.map((event, index) => <div className={`timeline-item ${index === selectedReport.timeline.length - 1 ? "timeline-current" : ""}`} key={`${event.at}-${index}`}><span className="timeline-dot">{index === selectedReport.timeline.length - 1 ? <i /> : <Check size={12} />}</span><div><strong>{statusLabels[event.status]}</strong><p>{event.note}</p><small>{event.actor || "FixDorm"} · {formatDate(event.at)}</small></div></div>)}</div> : <div className="timeline-empty">Riwayat status akan tampil di sini.</div>}</div>
        {role === "resident" && selectedReport.status === "completed" && <form className="review-box" onSubmit={submitReview}><h3>Bagaimana layanan teknisi?</h3><p>Penilaian Anda membantu meningkatkan kualitas layanan.</p><div className="star-row">{[1, 2, 3, 4, 5].map((star) => <button key={star} type="button" aria-label={`${star} bintang`} onClick={() => setReviewStars(star)}><Star size={23} fill={star <= reviewStars ? "currentColor" : "none"} /></button>)}</div><textarea value={reviewText} onChange={(event) => setReviewText(event.target.value)} placeholder={selectedReport.review || "Tulis ulasan singkat (opsional)"} rows={2} /><button className="button button-primary button-small" type="submit"><Check size={15} /> Kirim penilaian</button>{selectedReport.rating && <small className="existing-review">Penilaian tersimpan: {selectedReport.rating}/5</small>}</form>}
        </div><aside className="detail-side"><div className="side-card"><span className="side-label">PENGHUNI</span><div className="person-line"><span className={`avatar ${initialsColor(selectedReport.resident)}`}>{initials(selectedReport.resident)}</span><div><strong>{selectedReport.resident}</strong><small>Pelapor</small></div></div></div><div className="side-card"><span className="side-label">TEKNISI</span>{selectedReport.technician ? <div className="person-line"><span className={`avatar ${initialsColor(selectedReport.technician)}`}>{initials(selectedReport.technician)}</span><div><strong>{selectedReport.technician}</strong><small>{techs.find((tech) => tech.id === selectedReport.technicianId)?.title || "Teknisi asrama"}</small></div></div> : <p className="side-empty">Belum ada teknisi yang ditugaskan.</p>}{role === "admin" && <label className="side-field"><span>Tugaskan teknisi</span><select value={selectedReport.technicianId} disabled={busyReport || selectedReport.status === "completed"} onChange={(event) => { const tech = techs.find((person) => person.id === event.target.value); if (tech) void updateReport(selectedReport.id, { technicianId: tech.id, technician: tech.name, status: "awaiting_confirmation" }, `Pekerjaan ditawarkan kepada ${tech.name}.`); }}><option value="">Pilih teknisi...</option>{techs.filter((tech) => tech.skills.includes(selectedReport.category)).map((tech) => <option key={tech.id} value={tech.id}>{tech.name} · {tech.available ? "Tersedia" : "Sedang bertugas"}</option>)}</select></label>}</div>
          {role === "admin" && <div className="side-card"><span className="side-label">KELOLA LAPORAN</span><label className="side-field"><span>Prioritas</span><select value={selectedReport.priority} disabled={busyReport} onChange={(event) => void updateReport(selectedReport.id, { priority: event.target.value as Priority }, `Prioritas diubah menjadi ${priorityLabels[event.target.value as Priority].toLowerCase()}.`)}>{Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="side-field"><span>Status</span><select value={selectedReport.status} disabled={busyReport} onChange={(event) => void updateReport(selectedReport.id, { status: event.target.value as Status }, `Status diperbarui menjadi “${statusLabels[event.target.value as Status]}”.`)}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>}
          {role === "technician" && selectedReport.technicianId === (demo ? "tech-1" : sessionUser?.id) && selectedReport.status === "awaiting_confirmation" && <div className="technician-actions"><button className="button button-primary" disabled={busyReport} onClick={() => void updateReport(selectedReport.id, { status: "accepted" }, `${currentName} menerima pekerjaan ini.`)}><Check size={16} /> Terima pekerjaan</button><button className="button button-light" disabled={busyReport} onClick={() => void updateReport(selectedReport.id, { technicianId: "", technician: "", status: "awaiting_technician" }, `${currentName} menolak pekerjaan. Helpdesk dapat menawarkan kepada teknisi lain.`)}>Tolak pekerjaan</button></div>}
          {role === "technician" && selectedReport.technicianId === (demo ? "tech-1" : sessionUser?.id) && ["accepted", "in_progress", "waiting_parts"].includes(selectedReport.status) && <div className="side-card technician-work"><span className="side-label">PEMBARUAN PEKERJAAN</span><input ref={completionFileRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setCompletionFile(event.target.files?.[0] ?? null)} /><label className="side-field"><span>Status pekerjaan</span><select value={selectedReport.status} disabled={busyReport} onChange={(event) => void updateReport(selectedReport.id, { status: event.target.value as Status }, `Status pekerjaan diperbarui menjadi “${statusLabels[event.target.value as Status]}”.`)}>{(["accepted", "in_progress", "waiting_parts", "completed"] as Status[]).map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}</select></label><button className="upload-inline" onClick={() => completionFileRef.current?.click()}><ImagePlus size={16} />{completionFile ? completionFile.name : "Pilih foto hasil perbaikan"}</button>{completionFile && <button className="button button-primary button-small" disabled={busyReport} onClick={async () => { if (!supabase || !sessionUser) { const data = await readFile(completionFile); await updateReport(selectedReport.id, { afterPhotoUrl: data }, "Foto hasil perbaikan ditambahkan."); setCompletionFile(null); return; } const path = `${selectedReport.id}/${Date.now()}-${escapeFileName(completionFile.name)}`; const { error } = await supabase.storage.from("fixdorm-media").upload(path, completionFile, { contentType: completionFile.type, upsert: true }); if (error) { setToast(error.message); return; } await updateReport(selectedReport.id, { afterPhotoUrl: path }, "Foto hasil perbaikan ditambahkan."); setCompletionFile(null); }}>Simpan foto</button>}</div>}
          {selectedReport.estimatedHours && <div className="side-card estimate-card"><span className="side-label">ESTIMASI PENGERJAAN</span><strong>{selectedReport.estimatedHours} jam</strong><small>Perkiraan waktu dari teknisi</small></div>}
          {role === "technician" && selectedReport.technicianId === (demo ? "tech-1" : sessionUser?.id) && ["accepted", "in_progress", "waiting_parts"].includes(selectedReport.status) && <div className="side-card note-card"><span className="side-label">ESTIMASI & CATATAN</span><label className="side-field"><span>Estimasi selesai (jam)</span><input type="number" min="1" max="168" step="1" value={estimateDraft} onChange={(event) => setEstimateDraft(event.target.value)} placeholder="Contoh: 4" /></label><button className="button button-light button-small" disabled={busyReport || !estimateDraft || Number(estimateDraft) < 1 || Number(estimateDraft) > 168} onClick={() => void updateReport(selectedReport.id, { estimatedHours: Number(estimateDraft) }, `Estimasi pengerjaan: ${estimateDraft} jam.`)}>Simpan estimasi</button><label className="side-field"><span>Catatan perbaikan</span><textarea rows={3} maxLength={500} value={workNote} onChange={(event) => setWorkNote(event.target.value)} placeholder="Pemeriksaan atau pekerjaan yang dilakukan..." /></label><button className="button button-primary button-small" disabled={busyReport || !workNote.trim()} onClick={() => { const note = workNote.trim(); void updateReport(selectedReport.id, { status: selectedReport.status }, `Catatan teknisi: ${note}`).then(() => setWorkNote("")); }}>Tambahkan catatan</button></div>}
          <div className="detail-help"><ShieldCheck size={16} /><span>Setiap perubahan tercatat dalam riwayat laporan.</span></div></aside></div></Modal>}

    {showAuth && <AuthModal authMode={authMode} setAuthMode={setAuthMode} email={email} setEmail={setEmail} password={password} setPassword={setPassword} fullName={fullName} setFullName={setFullName} busy={authBusy} onClose={() => setShowAuth(false)} onSubmit={handleAuth} />}
    {toast && <div className="toast"><span className="toast-check"><Check size={15} /></span>{toast}<button aria-label="Tutup" onClick={() => setToast("")}><X size={15} /></button></div>}
  </div>;
}

function Overview({ role, name, reports, metrics, onCreate, onOpen, onNavigate }: { role: Role; name: string; reports: Report[]; metrics: { total: number; active: number; waiting: number; done: number }; onCreate: () => void; onOpen: (id: string) => void; onNavigate: () => void }) {
  const greeting = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  const welcome = role === "resident" ? "Kabar fasilitas asrama Anda." : role === "technician" ? "Pekerjaan yang perlu ditangani." : "Pantau layanan fasilitas asrama.";
  const recent = [...reports].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4);
  const cardData = role === "resident"
    ? [{ title: "Total laporan", value: metrics.total, hint: "Semua laporan Anda", icon: ClipboardList, tone: "red" }, { title: "Dalam proses", value: metrics.active, hint: "Sedang ditangani", icon: Wrench, tone: "blue" }, { title: "Menunggu", value: metrics.waiting, hint: "Perlu tindak lanjut", icon: Clock3, tone: "amber" }, { title: "Selesai", value: metrics.done, hint: "Perbaikan tuntas", icon: CheckCheck, tone: "green" }]
    : role === "technician"
      ? [{ title: "Pekerjaan saya", value: metrics.total, hint: "Ditugaskan kepada Anda", icon: ClipboardList, tone: "red" }, { title: "Dalam proses", value: metrics.active, hint: "Sedang ditangani", icon: Wrench, tone: "blue" }, { title: "Menunggu konfirmasi", value: metrics.waiting, hint: "Perlu respons Anda", icon: Clock3, tone: "amber" }, { title: "Selesai", value: metrics.done, hint: "Perbaikan tuntas", icon: CheckCheck, tone: "green" }]
    : [{ title: "Total laporan", value: reports.length, hint: "Semua laporan terdaftar", icon: ClipboardList, tone: "red" }, { title: "Dalam perbaikan", value: metrics.active, hint: "Dikerjakan teknisi", icon: Wrench, tone: "blue" }, { title: "Perlu ditangani", value: metrics.waiting, hint: "Menunggu tindak lanjut", icon: Clock3, tone: "amber" }, { title: "Selesai", value: metrics.done, hint: "Semua perbaikan tuntas", icon: CheckCheck, tone: "green" }];
  return <>
    <div className="welcome-row"><div><div className="date-line"><CalendarDays size={14} /> {greeting}</div><h1>Halo, {name.split(" ")[0]} <span className="wave">✳</span></h1><p>{welcome}</p></div><div className="welcome-actions">{role === "resident" && <button className="button button-primary" onClick={onCreate}><Plus size={17} /> Buat laporan</button>}</div></div>
    <div className="metric-grid">{cardData.map((card) => { const Icon = card.icon; return <article className="metric-card" key={card.title}><div className="metric-top"><span>{card.title}</span><span className={`metric-icon ${card.tone}`}><Icon size={18} /></span></div><div className="metric-value">{String(card.value).padStart(2, "0")}</div><div className="metric-hint">{card.hint}</div></article>; })}</div>
    <div className="overview-grid"><section className="panel activity-panel"><div className="panel-heading"><div><h2>Aktivitas laporan</h2><p>Ringkasan laporan dalam 7 hari terakhir</p></div><button className="period-select">7 hari terakhir <ChevronDown size={14} /></button></div><ActivityChart reports={reports} /></section><section className="panel priority-panel"><div className="panel-heading"><div><h2>Perlu perhatian</h2><p>Laporan yang menunggu tindak lanjut</p></div><span className="attention-count">{reports.filter((report) => ["pending_verification", "awaiting_technician"].includes(report.status)).length}</span></div><div className="attention-list">{reports.filter((report) => ["pending_verification", "awaiting_technician"].includes(report.status)).slice(0, 3).map((report) => <button className="attention-item" key={report.id} onClick={() => onOpen(report.id)}><span className={`attention-icon ${report.priority}`}><Lightbulb size={17} /></span><span className="attention-text"><strong>{report.item}</strong><small>{report.building} · {report.room}</small></span><ChevronRight size={16} /></button>)}{!reports.some((report) => ["pending_verification", "awaiting_technician"].includes(report.status)) && <div className="empty-inline"><CheckCircleDecor />Semua laporan sudah ditangani</div>}</div>{role === "admin" && <button className="panel-link" onClick={onNavigate}>Lihat antrean laporan <ArrowRight size={15} /></button>}{role === "resident" && <button className="panel-link" onClick={onCreate}>Laporkan masalah baru <ArrowRight size={15} /></button>}</section></div>
    <section className="panel reports-panel"><div className="panel-heading"><div><h2>{role === "technician" ? "Pekerjaan terbaru" : role === "resident" ? "Laporan terbaru" : "Laporan terbaru"}</h2><p>{role === "resident" ? "Perkembangan laporan kerusakan Anda" : "Laporan fasilitas asrama yang masuk"}</p></div><button className="panel-link heading-link" onClick={onNavigate}>Lihat semua <ArrowRight size={15} /></button></div><ReportTable reports={recent} role={role} onOpen={onOpen} onNavigate={onNavigate} compact /></section>
  </>;
}

function ActivityChart({ reports }: { reports: Report[] }) {
  const now = new Date();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart); date.setDate(date.getDate() + index);
    const previous = new Date(date); previous.setDate(previous.getDate() - 7);
    const countOn = (day: Date) => reports.filter((report) => { const created = new Date(report.createdAt); return created.getFullYear() === day.getFullYear() && created.getMonth() === day.getMonth() && created.getDate() === day.getDate(); }).length;
    return { label: new Intl.DateTimeFormat("id-ID", { weekday: "short" }).format(date), current: countOn(date), previous: countOn(previous) };
  });
  const scale = Math.max(4, Math.ceil(Math.max(1, ...days.flatMap((day) => [day.current, day.previous])) / 4) * 4);
  return <div className="chart-wrap"><div className="chart-y"><span>{scale}</span><span>{Math.round(scale * .67)}</span><span>{Math.round(scale * .33)}</span><span>0</span></div><div className="chart-area"><div className="chart-grid"><i /><i /><i /><i /></div><div className="chart-bars">{days.map((day, index) => <div className="chart-bar-cell" key={`${day.label}-${index}`}><span className="chart-count">{day.current}</span><div className="bar-track"><i className="bar-main" style={{ height: `${Math.max(3, day.current / scale * 100)}%` }} /><i className="bar-compare" style={{ height: `${Math.max(3, day.previous / scale * 100)}%` }} /></div><small>{day.label}</small></div>)}</div><div className="chart-legend"><span><i /> Minggu ini</span><span><i /> Minggu lalu</span></div></div></div>;
}

function CheckCircleDecor() { return <span className="empty-check"><Check size={16} /></span>; }

function ReportsPage({ role, reports, query, filter, setFilter, onCreate, onOpen, onQuickUpdate }: { role: Role; reports: Report[]; query: string; filter: "all" | Status; setFilter: (filter: "all" | Status) => void; onCreate: () => void; onOpen: (id: string) => void; onQuickUpdate: (id: string, changes: Partial<Report>, note: string) => Promise<void> }) {
  const filters: { label: string; value: "all" | Status }[] = [{ label: "Semua", value: "all" }, { label: "Menunggu", value: "pending_verification" }, { label: "Dalam proses", value: "in_progress" }, { label: "Selesai", value: "completed" }];
  return <><div className="page-heading-row"><div><span className="eyebrow">RUANG KERJA</span><h1>{role === "technician" ? "Pekerjaan saya" : role === "resident" ? "Laporan saya" : "Laporan fasilitas"}</h1><p>{role === "resident" ? "Pantau setiap perkembangan laporan Anda." : role === "technician" ? "Tugas yang ditawarkan sesuai keahlian Anda." : "Kelola dan pantau semua laporan perbaikan asrama."}</p></div>{role === "resident" && <button className="button button-primary" onClick={onCreate}><Plus size={17} /> Laporan baru</button>}</div><section className="panel full-reports-panel"><div className="reports-toolbar"><div className="filter-tabs">{filters.map((item) => <button key={item.value} className={filter === item.value ? "filter-active" : ""} onClick={() => setFilter(item.value)}>{item.label}{item.value !== "all" && <small>{reports.filter((report) => report.status === item.value).length}</small>}</button>)}</div><button className="filter-button" onClick={() => setFilter("all")}><SlidersHorizontal size={15} /> Filter <Filter size={13} /></button></div><ReportTable reports={reports} role={role} onOpen={onOpen} onNavigate={() => {}} onQuickUpdate={onQuickUpdate} /><div className="table-footer"><span>Menampilkan <strong>{reports.length}</strong> laporan{query ? ` untuk “${query}”` : ""}</span><div><button className="pagination-button" disabled><ChevronLeft size={15} /></button><button className="pagination-page">1</button><button className="pagination-button" disabled><ChevronRight size={15} /></button></div></div></section></>;
}

function ReportTable({ reports, role, onOpen, onNavigate, compact = false, onQuickUpdate }: { reports: Report[]; role: Role; onOpen: (id: string) => void; onNavigate: () => void; compact?: boolean; onQuickUpdate?: (id: string, changes: Partial<Report>, note: string) => Promise<void> }) {
  return <div className={`table-scroll ${compact ? "table-compact" : ""}`}><table className="report-table"><thead><tr><th>LAPORAN</th><th>LOKASI</th>{role !== "resident" && <th>PELAPOR</th>}<th>STATUS</th><th>PRIORITAS</th><th /></tr></thead><tbody>{reports.length ? reports.map((report) => <tr key={report.id} onClick={() => onOpen(report.id)}><td><div className="report-cell"><span className={`report-type-icon ${categories.find((category) => category.label === report.category)?.label === "Kelistrikan" ? "electric" : report.category === "Perpipaan & air" ? "plumbing" : report.category === "Furniture" ? "furniture" : "other"}`}>{report.category === "Kelistrikan" ? <Zap size={16} /> : report.category === "Perpipaan & air" ? <Droplets size={16} /> : report.category === "Peralatan elektronik" ? <Activity size={16} /> : <Wrench size={16} />}</span><span><strong>{report.item}</strong><small>{report.code} <i /> {formatShort(report.createdAt)}</small></span></div></td><td><span className="table-location">{report.building}<small>{report.room}</small></span></td>{role !== "resident" && <td><div className="resident-cell"><span className={`avatar avatar-tiny ${initialsColor(report.resident)}`}>{initials(report.resident)}</span>{report.resident}</div></td>}<td><StatusPill status={report.status} /></td><td><PriorityPill priority={report.priority} /></td><td><div className="row-action">{role === "admin" && report.status === "pending_verification" && onQuickUpdate ? <button className="verify-button" onClick={(event) => { event.stopPropagation(); void onQuickUpdate(report.id, { status: "awaiting_technician" }, "Laporan diverifikasi oleh helpdesk."); }}>Verifikasi</button> : <button className="icon-button row-more" aria-label="Lihat laporan" onClick={(event) => { event.stopPropagation(); onOpen(report.id); }}><ChevronRight size={17} /></button>}</div></td></tr>) : <tr><td className="table-empty" colSpan={role === "resident" ? 5 : 6}><FileText size={22} /><strong>Belum ada laporan</strong><span>{role === "resident" ? "Buat laporan baru jika ada fasilitas yang perlu diperbaiki." : "Laporan yang sesuai akan muncul di sini."}</span>{role === "resident" && <button className="button button-primary button-small" onClick={(event) => { event.stopPropagation(); onNavigate(); }}>Lihat ringkasan <ArrowRight size={14} /></button>}</td></tr>}</tbody></table></div>;
}

function TeamPage({ techs, reports, onAssign }: { techs: Tech[]; reports: Report[]; onAssign: (report: Report) => void }) {
  const active = techs.filter((tech) => tech.available).length;
  return <><div className="page-heading-row"><div><span className="eyebrow">OPERASIONAL</span><h1>Tim teknisi</h1><p>Kelola ketersediaan dan keahlian tim perbaikan asrama.</p></div><span className="team-live"><span className="live-dot" /> {active} teknisi tersedia</span></div><div className="team-summary"><div className="team-summary-card"><Users size={19} /><span>Jumlah teknisi</span><strong>{techs.length}</strong></div><div className="team-summary-card"><Activity size={19} /><span>Siap bertugas</span><strong>{active}</strong></div><div className="team-summary-card"><Star size={19} /><span>Rata-rata rating</span><strong>{(techs.reduce((total, tech) => total + tech.rating, 0) / Math.max(1, techs.length)).toFixed(1)} <small>/ 5</small></strong></div></div><div className="technician-grid">{techs.map((tech) => <article className="panel tech-card" key={tech.id}><div className="tech-card-top"><span className={`avatar avatar-large ${initialsColor(tech.name)}`}>{tech.initials}</span><span className={`availability ${tech.available ? "available" : "busy"}`}><i />{tech.available ? "Tersedia" : "Sedang bertugas"}</span></div><h2>{tech.name}</h2><p>{tech.title}</p><div className="tech-stats"><span><Star size={14} fill="currentColor" /> {tech.rating.toFixed(1)} <small>rating</small></span><span><CheckCheck size={14} /> {tech.jobs} <small>pekerjaan</small></span></div><div className="skill-tags">{tech.skills.map((skill) => <span key={skill}>{skill}</span>)}</div></article>)}</div><section className="panel unassigned-panel"><div className="panel-heading"><div><h2>Laporan belum memiliki teknisi</h2><p>Pasangkan laporan dengan teknisi yang sesuai.</p></div><span className="attention-count">{reports.filter((report) => !report.technicianId && report.status !== "completed").length}</span></div>{reports.filter((report) => !report.technicianId && report.status !== "completed").length ? reports.filter((report) => !report.technicianId && report.status !== "completed").slice(0, 5).map((report) => <button className="unassigned-row" key={report.id} onClick={() => onAssign(report)}><span><strong>{report.item}</strong><small>{report.building} · {report.category}</small></span><span className="matched-tech">{techs.filter((tech) => tech.skills.includes(report.category)).length} teknisi cocok <ArrowRight size={14} /></span></button>) : <div className="empty-inline"><CheckCircleDecor />Semua laporan sudah mendapatkan teknisi.</div>}</section></>;
}

function AnalyticsPage({ reports }: { reports: Report[] }) {
  const completed = reports.filter((report) => report.status === "completed").length;
  const ratingReports = reports.filter((report) => report.rating);
  const rating = ratingReports.length ? ratingReports.reduce((sum, report) => sum + (report.rating ?? 0), 0) / ratingReports.length : 0;
  const categoriesCount = categories.map((category) => ({ ...category, count: reports.filter((report) => report.category === category.label).length })).sort((a, b) => b.count - a.count);
  const max = Math.max(1, ...categoriesCount.map((category) => category.count));
  return <><div className="page-heading-row"><div><span className="eyebrow">WAWASAN LAYANAN</span><h1>Analitik fasilitas</h1><p>Ringkasan kerusakan dan kualitas layanan asrama.</p></div><button className="period-select"><CalendarDays size={15} /> 30 hari terakhir <ChevronDown size={14} /></button></div><div className="analytics-kpis"><div className="panel analytics-kpi"><span className="metric-icon red"><ClipboardList size={17} /></span><small>Total laporan</small><strong>{reports.length}</strong><span>Semua kategori</span></div><div className="panel analytics-kpi"><span className="metric-icon green"><CheckCheck size={17} /></span><small>Diselesaikan</small><strong>{completed}</strong><span>{reports.length ? Math.round(completed / reports.length * 100) : 0}% dari laporan</span></div><div className="panel analytics-kpi"><span className="metric-icon amber"><Star size={17} /></span><small>Penilaian penghuni</small><strong>{rating ? rating.toFixed(1) : "—"}<small>/ 5</small></strong><span>{ratingReports.length} ulasan masuk</span></div><div className="panel analytics-kpi"><span className="metric-icon blue"><Clock3 size={17} /></span><small>Menunggu tindakan</small><strong>{reports.filter((report) => ["pending_verification", "awaiting_technician", "awaiting_confirmation"].includes(report.status)).length}</strong><span>Perlu ditindaklanjuti</span></div></div><div className="analytics-grid"><section className="panel category-panel"><div className="panel-heading"><div><h2>Laporan per kategori</h2><p>Distribusi jenis kerusakan</p></div><span className="period-small">30 hari terakhir</span></div><div className="category-bars">{categoriesCount.map((category) => { const Icon = category.icon; return <div className="category-row" key={category.label}><span className="category-row-label"><Icon size={16} />{category.label}</span><div className="category-track"><i style={{ width: `${category.count / max * 100}%` }} /></div><strong>{category.count}</strong></div>; })}</div></section><section className="panel reviews-panel"><div className="panel-heading"><div><h2>Ulasan terbaru</h2><p>Masukan dari penghuni</p></div><MessageSquareText size={18} className="panel-muted-icon" /></div>{ratingReports.length ? ratingReports.slice(0, 4).map((report) => <div className="review-row" key={report.id}><span className={`avatar avatar-small ${initialsColor(report.resident)}`}>{initials(report.resident)}</span><div><strong>{report.resident}</strong><small>{report.review}</small></div><span className="review-rating"><Star size={13} fill="currentColor" />{report.rating}</span></div>) : <div className="empty-inline"><MessageSquareText size={17} />Ulasan penghuni akan muncul setelah perbaikan selesai.</div>}</section></div></>;
}

function SettingsPage({ demo, name, email, onSignOut }: { demo: boolean; name: string; email: string; onSignOut: () => void }) {
  return <><div className="page-heading-row"><div><span className="eyebrow">PREFERENSI</span><h1>Pengaturan</h1><p>Kelola koneksi dan informasi akun FixDorm.</p></div></div><div className="settings-layout"><section className="panel settings-card"><div className="settings-title"><span className="settings-icon"><ShieldCheck size={19} /></span><div><h2>Koneksi aplikasi</h2><p>Status database dan autentikasi</p></div></div><div className={`connection-status ${demo ? "connection-demo" : "connection-live"}`}><i />{demo ? "Mode pratinjau aktif" : "Terhubung ke Supabase"}</div><p className="settings-copy">{demo ? "Data saat ini disimpan di browser ini agar Anda dapat mencoba alur FixDorm. Hubungkan project Supabase untuk mengaktifkan akun, penyimpanan online, foto, dan pembaruan realtime." : "Akun Anda menggunakan autentikasi Supabase. Laporan tersimpan dengan kontrol akses berdasarkan peran pengguna."}</p>{demo ? <div className="setup-steps"><strong>Langkah mengaktifkan Supabase</strong><ol><li>Buat project di Supabase, lalu jalankan SQL dari <code>supabase/schema.sql</code>.</li><li>Tambahkan <code>NEXT_PUBLIC_SUPABASE_URL</code> dan <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> ke environment project.</li><li>Deploy ulang; penghuni dapat membuat akun, sementara akun helpdesk dan teknisi dibuat oleh admin.</li></ol><p>Nama admin demo: <code>Nanda Putri</code> · Teknisi demo: <code>Bima Saputra</code></p></div> : <div className="settings-row"><span>Database & autentikasi</span><span><span className="live-dot" /> Aktif</span></div>}</section><section className="panel settings-card"><div className="settings-title"><span className="settings-icon settings-person"><Users size={19} /></span><div><h2>Akun Anda</h2><p>Informasi profil pengguna</p></div></div><div className="account-profile"><span className={`avatar avatar-large ${initialsColor(name)}`}>{initials(name)}</span><div><strong>{name}</strong><small>{email || (demo ? "Pengguna demo" : "")}</small></div></div><div className="settings-row"><span>Peran</span><strong>{demo ? "Mode pratinjau" : "Terverifikasi melalui admin"}</strong></div>{!demo && <button className="button button-light signout-button" onClick={onSignOut}><LogOut size={16} /> Keluar dari akun</button>}</section></div><div className="settings-note"><ShieldCheck size={16} /><span>FixDorm tidak menggunakan logo resmi Telkom University. Data proyek Supabase tetap berada di bawah kendali pengelola asrama.</span></div></>;
}

function AuthModal({ authMode, setAuthMode, email, setEmail, password, setPassword, fullName, setFullName, busy, onClose, onSubmit }: { authMode: "signin" | "signup"; setAuthMode: (mode: "signin" | "signup") => void; email: string; setEmail: (value: string) => void; password: string; setPassword: (value: string) => void; fullName: string; setFullName: (value: string) => void; busy: boolean; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <Modal title={authMode === "signin" ? "Selamat datang kembali" : "Buat akun penghuni"} subtitle={authMode === "signin" ? "Masuk untuk mengelola laporan fasilitas." : "Daftar menggunakan email asrama Anda."} onClose={onClose}><form className="form-body auth-form" onSubmit={onSubmit}>{authMode === "signup" && <label className="field"><span>Nama lengkap <b>*</b></span><input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Nama Anda" required maxLength={100} /></label>}<label className="field"><span>Email <b>*</b></span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@asrama.ac.id" required /></label><label className="field"><span>Kata sandi <b>*</b></span><input type="password" autoComplete={authMode === "signin" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimal 8 karakter" minLength={8} required /></label><button className="button button-primary auth-submit" disabled={busy}>{busy ? <span className="spinner" /> : <LogIn size={17} />}{authMode === "signin" ? "Masuk" : "Buat akun penghuni"}<ArrowRight size={16} /></button><p className="auth-switch">{authMode === "signin" ? "Belum punya akun penghuni?" : "Sudah terdaftar?"} <button type="button" onClick={() => setAuthMode(authMode === "signin" ? "signup" : "signin")}>{authMode === "signin" ? "Daftar" : "Masuk"}</button></p><div className="auth-security"><ShieldCheck size={15} /> Pengelola membuat akun admin dan teknisi.</div></form></Modal>;
}

