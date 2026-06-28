import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import './styles.css';

const TABLES = {
  members: 'ta_members',
  goals: 'ta_goals',
  wins: 'ta_wins',
  photos: 'ta_photos',
  settings: 'ta_settings',
};

const DEFAULT_SETTINGS = {
  id: 'shared',
  title: 'Our Achievements',
  subtitle: 'TA team dashboard — set goals, move through milestones, and celebrate wins together.',
};

const COLORS = [
  '#E12B4C', '#9A4E97', '#5E6FB6', '#16A085', '#F39C12', '#2C7BE5',
  '#C0392B', '#6C5CE7', '#00A6A6', '#FF6B6B', '#7B61FF', '#2E86AB',
  '#D65DB1', '#008F7A', '#B8860B', '#34495E', '#E67E22', '#4D8076',
];
const TABS = ['Overview', 'Goals', 'Achievements', 'Analytics', 'Gallery'];
const USER_KEY = 'proxet-ta-current-user';
const ACHIEVEMENT_CATEGORIES = [
  '🎓 Education & Learning',
  '🏃 Health & Sport',
  '✈️ Travel & Adventure',
  '🍳 Food & Cooking',
  '🐾 Animals & Pets',
  '❤️ Community & Kindness',
  '🎨 Creativity & Hobbies',
  '👥 Relationships & Family',
  '🌟 Personal Growth',
  '💰 Milestones & Life',
];

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

function uid(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function nowIso() {
  return new Date().toISOString();
}

function initials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'TA';
}

function formatDate(date) {
  if (!date) return '';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(date));
}

function goalProgress(goal) {
  const total = goal.milestones?.length || 0;
  const done = goal.milestones?.filter((step) => step.done).length || 0;
  return { total, done, percent: total ? Math.round((done / total) * 100) : 0 };
}

function goalStatus(goal) {
  const { percent } = goalProgress(goal);
  if (percent === 0) return 'Not started';
  if (percent === 100) return 'Done';
  return 'In progress';
}

function isDeadlineNear(deadline) {
  if (!deadline) return false;
  const days = (new Date(deadline) - new Date()) / 86400000;
  return days >= 0 && days <= 7;
}

function normalizeMilestone(step) {
  if (typeof step === 'string') {
    return { id: uid('step'), label: step, deadline: '', images: [], done: false };
  }
  const legacyImage = step.imageData || step.image_data || '';
  return {
    id: step.id || uid('step'),
    label: step.label || '',
    deadline: step.deadline || '',
    images: Array.isArray(step.images) ? step.images : legacyImage ? [legacyImage] : [],
    done: Boolean(step.done),
  };
}

function nearestMilestoneDeadline(goal) {
  return (goal.milestones || [])
    .map((step) => step.deadline)
    .filter(Boolean)
    .sort((a, b) => new Date(a) - new Date(b))[0] || '';
}

function goalImages(goal) {
  return [
    goal.coverImageData,
    ...(goal.milestones || []).flatMap((step) => step.images || []),
  ].filter(Boolean);
}

function goalCoverImage(goal) {
  return goalImages(goal)[0] || '';
}

function completionDate(goal) {
  const doneMilestones = (goal.milestones || []).filter((step) => step.done);
  const latestDeadline = doneMilestones
    .map((step) => step.deadline)
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a))[0];
  return latestDeadline || goal.deadline || goal.createdAt;
}

function thisMonth(date) {
  const target = new Date(date);
  const now = new Date();
  return target.getFullYear() === now.getFullYear() && target.getMonth() === now.getMonth();
}

function normalizeMember(row) {
  return {
    id: row.id,
    name: row.name,
    role: row.role || '',
    color: row.color || COLORS[0],
    avatarData: row.avatar_data || row.avatarData || '',
    createdAt: row.created_at || row.createdAt || nowIso(),
  };
}

function normalizeGoal(row) {
  return {
    id: row.id,
    memberId: row.member_id || row.memberId,
    title: row.title,
    deadline: row.deadline || '',
    milestones: (row.milestones || []).map(normalizeMilestone),
    coverImageData: row.cover_image_data || row.coverImageData || '',
    createdAt: row.created_at || row.createdAt || nowIso(),
  };
}

function normalizeWin(row) {
  const legacyImage = row.image_data || row.imageData || '';
  return {
    id: row.id,
    memberId: row.member_id || row.memberId,
    title: row.title,
    note: row.note || '',
    date: row.date || row.created_at || row.createdAt || nowIso(),
    category: row.category || '🌟 Personal Growth',
    images: Array.isArray(row.images) ? row.images : legacyImage ? [legacyImage] : [],
    createdAt: row.created_at || row.createdAt || nowIso(),
  };
}

function normalizePhoto(row) {
  return {
    id: row.id,
    memberId: row.member_id || row.memberId,
    caption: row.caption || '',
    imageData: row.image_data || row.imageData,
    createdAt: row.created_at || row.createdAt || nowIso(),
  };
}

function toDbPayload(type, item) {
  if (type === 'members') {
    return { id: item.id, name: item.name, role: item.role, color: item.color, avatar_data: item.avatarData || null, created_at: item.createdAt };
  }
  if (type === 'goals') {
    return {
      id: item.id,
      member_id: item.memberId,
      title: item.title,
      deadline: item.deadline || null,
      milestones: item.milestones,
      cover_image_data: item.coverImageData || null,
      created_at: item.createdAt,
    };
  }
  if (type === 'wins') {
    return {
      id: item.id,
      member_id: item.memberId,
      title: item.title,
      note: item.note,
      date: item.date,
      category: item.category || '🌟 Personal Growth',
      image_data: item.images?.[0] || item.imageData || null,
      images: item.images || (item.imageData ? [item.imageData] : []),
      created_at: item.createdAt,
    };
  }
  if (type === 'photos') {
    return { id: item.id, member_id: item.memberId, caption: item.caption, image_data: item.imageData, created_at: item.createdAt };
  }
  return { id: 'shared', title: item.title, subtitle: item.subtitle, updated_at: nowIso() };
}

function sortByCreated(items) {
  return [...items].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function createLocalStore() {
  const key = 'proxet-ta-demo-store';
  const listeners = new Set();
  const initial = {
    members: [],
    goals: [],
    wins: [],
    photos: [],
    settings: DEFAULT_SETTINGS,
  };
  const read = () => JSON.parse(localStorage.getItem(key) || JSON.stringify(initial));
  const write = (next) => {
    localStorage.setItem(key, JSON.stringify(next));
    listeners.forEach((listener) => listener(read()));
  };
  return {
    async load() {
      return read();
    },
    subscribe(listener) {
      listeners.add(listener);
      const onStorage = () => listener(read());
      window.addEventListener('storage', onStorage);
      return () => {
        listeners.delete(listener);
        window.removeEventListener('storage', onStorage);
      };
    },
    async upsert(type, item) {
      const data = read();
      if (type === 'settings') {
        write({ ...data, settings: { ...data.settings, ...item } });
        return;
      }
      const items = data[type].filter((entry) => entry.id !== item.id);
      write({ ...data, [type]: sortByCreated([...items, item]) });
    },
    async remove(type, id) {
      const data = read();
      write({ ...data, [type]: data[type].filter((item) => item.id !== id) });
    },
  };
}

function createSupabaseStore() {
  const normalizers = {
    members: normalizeMember,
    goals: normalizeGoal,
    wins: normalizeWin,
    photos: normalizePhoto,
  };
  return {
    async load() {
      const [members, goals, wins, photos, settings] = await Promise.all([
        supabase.from(TABLES.members).select('*').order('created_at'),
        supabase.from(TABLES.goals).select('*').order('created_at'),
        supabase.from(TABLES.wins).select('*').order('created_at'),
        supabase.from(TABLES.photos).select('*').order('created_at'),
        supabase.from(TABLES.settings).select('*').eq('id', 'shared').maybeSingle(),
      ]);
      const failed = [members, goals, wins, photos, settings].find((result) => result.error);
      if (failed) throw failed.error;
      return {
        members: members.data.map(normalizeMember),
        goals: goals.data.map(normalizeGoal),
        wins: wins.data.map(normalizeWin),
        photos: photos.data.map(normalizePhoto),
        settings: settings.data ? { ...DEFAULT_SETTINGS, title: settings.data.title, subtitle: settings.data.subtitle } : DEFAULT_SETTINGS,
      };
    },
    subscribe(listener) {
      const channel = supabase
        .channel('ta-dashboard-board')
        .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.members }, listener)
        .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.goals }, listener)
        .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.wins }, listener)
        .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.photos }, listener)
        .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.settings }, listener)
        .subscribe();
      return () => supabase.removeChannel(channel);
    },
    async upsert(type, item) {
      const table = TABLES[type];
      const { error } = await supabase.from(table).upsert(toDbPayload(type, item));
      if (error) throw error;
    },
    async remove(type, id) {
      const { error } = await supabase.from(TABLES[type]).delete().eq('id', id);
      if (error) throw error;
    },
  };
}

async function compressImage(file) {
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
  const longest = Math.max(image.width, image.height);
  const scale = Math.min(1, 1000 / longest);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(image.src);
  return canvas.toDataURL('image/jpeg', 0.72);
}

function useBoardStore() {
  const store = useMemo(() => (supabase ? createSupabaseStore() : createLocalStore()), []);
  const [state, setState] = useState({ members: [], goals: [], wins: [], photos: [], settings: DEFAULT_SETTINGS });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = async () => {
    try {
      setState(await store.load());
      setError('');
    } catch (err) {
      setError(err.message || 'Unable to load board data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    const unsubscribe = store.subscribe(reload);
    const timer = window.setInterval(reload, 20000);
    return () => {
      unsubscribe?.();
      window.clearInterval(timer);
    };
  }, [store]);

  return {
    ...state,
    loading,
    error,
    shared: Boolean(supabase),
    upsert: store.upsert,
    remove: store.remove,
    reload,
  };
}

function App() {
  const board = useBoardStore();
  const [activeTab, setActiveTab] = useState('Overview');
  const [currentUserId, setCurrentUserId] = useState(() => localStorage.getItem(USER_KEY) || '');
  const [modal, setModal] = useState(null);
  const [confettiSeed, setConfettiSeed] = useState(0);
  const [lightboxImage, setLightboxImage] = useState(null);
  const currentUser = board.members.find((member) => member.id === currentUserId);

  useEffect(() => {
    if (currentUserId && !board.members.some((member) => member.id === currentUserId)) {
      setCurrentUserId('');
      localStorage.removeItem(USER_KEY);
    }
  }, [board.members, currentUserId]);

  const setUser = (id) => {
    setCurrentUserId(id);
    localStorage.setItem(USER_KEY, id);
  };

  const stats = useMemo(() => ({
    Members: board.members.length,
    Goals: board.goals.length,
    Completed: board.goals.filter((goal) => goalStatus(goal) === 'Done').length,
    Wins: board.wins.length,
  }), [board.members, board.goals, board.wins]);

  const memberById = useMemo(() => new Map(board.members.map((member) => [member.id, member])), [board.members]);

  const addMember = async (values) => {
    const member = { id: uid('member'), createdAt: nowIso(), ...values };
    await board.upsert('members', member);
    setUser(member.id);
    setModal(null);
  };

  const saveMember = async (values) => {
    if (!currentUser) return;
    await board.upsert('members', { ...currentUser, ...values });
    setModal(null);
  };

  const addGoal = async (values) => {
    if (!currentUser) return setModal('member');
    await board.upsert('goals', {
      id: uid('goal'),
      memberId: currentUser.id,
      title: values.title,
      deadline: values.deadline,
      milestones: values.milestones.map((step) => ({ ...step, id: step.id || uid('step'), done: Boolean(step.done) })),
      coverImageData: values.coverImageData || '',
      createdAt: nowIso(),
    });
    setModal(null);
    setActiveTab('Goals');
  };

  const saveGoal = async (goal, values) => {
    if (goal.memberId !== currentUser?.id) return;
    await board.upsert('goals', {
      ...goal,
      title: values.title,
      deadline: values.deadline,
      milestones: values.milestones.map((step) => ({ ...step, id: step.id || uid('step'), done: Boolean(step.done) })),
      coverImageData: values.coverImageData || '',
    });
    setModal(null);
    setActiveTab('Goals');
  };

  const saveGoalCover = async (goal, file) => {
    if (goal.memberId !== currentUser?.id || !file) return;
    const coverImageData = await compressImage(file);
    await board.upsert('goals', { ...goal, coverImageData });
  };

  const addAchievement = async (values) => {
    if (!currentUser && !values.memberId) return setModal('member');
    const images = values.files?.length ? await Promise.all(values.files.map(compressImage)) : [];
    await board.upsert('wins', {
      id: uid('win'),
      memberId: values.memberId || currentUser.id,
      title: values.title,
      note: values.note,
      date: values.date || nowIso(),
      category: values.category,
      images,
      createdAt: nowIso(),
    });
    setConfettiSeed((seed) => seed + 1);
    setModal(null);
    setActiveTab('Achievements');
  };

  const addPhoto = async (values) => {
    if (!currentUser) return setModal('member');
    const imageData = await compressImage(values.file);
    await board.upsert('photos', {
      id: uid('photo'),
      memberId: currentUser.id,
      caption: values.caption,
      imageData,
      createdAt: nowIso(),
    });
    setModal(null);
    setActiveTab('Gallery');
  };

  const toggleStep = async (goal, stepId) => {
    if (goal.memberId !== currentUser?.id) return;
    const before = goalProgress(goal).percent;
    const updated = {
      ...goal,
      milestones: goal.milestones.map((step) => (step.id === stepId ? { ...step, done: !step.done } : step)),
    };
    await board.upsert('goals', updated);
    if (before < 100 && goalProgress(updated).percent === 100) {
      setConfettiSeed((seed) => seed + 1);
    }
  };

  const saveSettings = async (patch) => {
    await board.upsert('settings', { ...board.settings, ...patch });
  };

  return (
    <div className="app">
      <Confetti seed={confettiSeed} />
      <header className="topbar">
        <div className="brand" aria-label="Proxet">
          <span className="brand-mark" />
          <span className="brand-word">proxet</span>
        </div>
        <span className="site-link">Website</span>
      </header>

      <main>
        <section className="hero">
          <InlineText className="hero-title" value={board.settings.title} fallback={DEFAULT_SETTINGS.title} onSave={(title) => saveSettings({ title })} />
          <InlineText className="hero-subtitle" value={board.settings.subtitle} fallback={DEFAULT_SETTINGS.subtitle} onSave={(subtitle) => saveSettings({ subtitle })} multiline />
        </section>

        {!board.shared && (
          <div className="notice">
            Demo mode: add Supabase env variables to make this one shared board for everyone with the link.
          </div>
        )}
        {board.error && <div className="notice error">{board.error}</div>}

        <section className="identity-bar" aria-label="Who are you?">
          <span className="bar-title">Who are you?</span>
          <div className="chips">
            {board.members.map((member) => (
              <button
                key={member.id}
                className={`chip ${member.id === currentUserId ? 'active' : ''}`}
                style={{ '--member-color': member.color }}
                onClick={() => setUser(member.id)}
              >
                <MiniAvatar member={member} />{member.name}
              </button>
            ))}
            <button className="chip add-chip" onClick={() => setModal('member')}>+ Add yourself</button>
            {currentUser && <button className="chip edit-chip" onClick={() => setModal({ type: 'member', member: currentUser })}>Edit profile</button>}
          </div>
        </section>

        <section className="stat-strip">
          {Object.entries(stats).map(([label, value]) => (
            <article className="stat-card" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </section>

        <nav className="tabs" aria-label="Dashboard sections">
          {TABS.map((tab) => (
            <button className={activeTab === tab ? 'active' : ''} key={tab} onClick={() => setActiveTab(tab)}>{tab}</button>
          ))}
        </nav>

        <section className="panel" key={activeTab}>
          {board.loading && <div className="empty">Loading board...</div>}
          {!board.loading && activeTab === 'Overview' && <Overview members={board.members} goals={board.goals} wins={board.wins} currentUser={currentUser} onAdd={() => setModal('member')} onGoalCoverChange={saveGoalCover} onOpenImage={setLightboxImage} />}
          {!board.loading && activeTab === 'Goals' && (
            <Goals
              goals={board.goals}
              members={memberById}
              currentUser={currentUser}
              onToggle={toggleStep}
              onOpenImage={setLightboxImage}
              onAdd={() => setModal(currentUser ? 'goal' : 'member')}
              onEdit={(goal) => setModal({ type: 'goal', goal })}
            />
          )}
          {!board.loading && activeTab === 'Analytics' && <Analytics members={board.members} goals={board.goals} wins={board.wins} />}
          {!board.loading && activeTab === 'Gallery' && <Gallery photos={board.photos} goals={board.goals} members={memberById} currentUser={currentUser} onAdd={() => setModal(currentUser ? 'photo' : 'member')} onDelete={(id) => board.remove('photos', id)} />}
          {!board.loading && activeTab === 'Achievements' && <Achievements goals={board.goals} wins={board.wins} members={board.members} memberById={memberById} onAdd={() => setModal(currentUser ? 'achievement' : 'member')} onOpenImage={setLightboxImage} />}
        </section>
      </main>

      <footer>
        <span>Sensitivity: [Internal]</span>
        <span>This board is shared with everyone who has the link.</span>
      </footer>

      {modal === 'member' && <MemberModal onSave={addMember} onClose={() => setModal(null)} />}
      {modal?.type === 'member' && <MemberModal member={modal.member} onSave={saveMember} onClose={() => setModal(null)} />}
      {modal === 'goal' && <GoalModal onSave={addGoal} onClose={() => setModal(null)} />}
      {modal?.type === 'goal' && <GoalModal goal={modal.goal} onSave={(values) => saveGoal(modal.goal, values)} onClose={() => setModal(null)} />}
      {modal === 'photo' && <PhotoModal onSave={addPhoto} onClose={() => setModal(null)} />}
      {modal === 'achievement' && <AchievementModal members={board.members} currentUser={currentUser} onSave={addAchievement} onClose={() => setModal(null)} />}
      {lightboxImage && <Lightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />}
    </div>
  );
}

function InlineText({ value, fallback, onSave, className, multiline = false }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || fallback);

  useEffect(() => setDraft(value || fallback), [value, fallback]);

  const commit = () => {
    const next = draft.trim() || fallback;
    setEditing(false);
    if (next !== value) onSave(next);
  };

  if (editing) {
    const Input = multiline ? 'textarea' : 'input';
    return (
      <Input
        className={`${className} inline-editor`}
        value={draft}
        autoFocus
        rows={2}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !multiline) commit();
          if (event.key === 'Escape') setEditing(false);
        }}
      />
    );
  }
  return <button className={`${className} inline-text`} onClick={() => setEditing(true)}>{value || fallback}</button>;
}

function Overview({ members, goals, wins, currentUser, onAdd, onGoalCoverChange, onOpenImage }) {
  return (
    <div className="overview-stack">
      <div className="member-grid">
        {members.map((member) => {
          const memberGoals = goals.filter((goal) => goal.memberId === member.id).length;
          return (
            <article className="member-card" key={member.id}>
              <Avatar member={member} />
              <div>
                <h3>{member.name}</h3>
                <p>{member.role || 'Talent Acquisition'}</p>
                <span>{memberGoals} goals</span>
              </div>
            </article>
          );
        })}
        <button className="add-card" onClick={onAdd}>+ Add member</button>
      </div>
      <TeamOverview members={members} goals={goals} wins={wins} currentUser={currentUser} onGoalCoverChange={onGoalCoverChange} onOpenImage={onOpenImage} />
    </div>
  );
}

function TeamOverview({ members, goals, wins, currentUser, onGoalCoverChange, onOpenImage }) {
  return (
    <section className="team-overview" aria-label="Talent Acquisition Team">
      <div className="section-head">
        <h2>Talent Acquisition Team</h2>
      </div>
      {members.length === 0 && <div className="empty">No members yet.</div>}
      <div className="team-list">
        {members.map((member) => {
          const memberGoals = goals.filter((goal) => goal.memberId === member.id);
          const memberWins = wins.filter((win) => win.memberId === member.id);
          return (
            <article className="team-member-row" key={member.id} style={{ '--member-color': member.color }}>
              <div className="team-person">
                <Avatar member={member} />
                <div>
                  <h3>{member.name}</h3>
                  <p>{member.role || 'Talent Acquisition'}</p>
                </div>
              </div>
              <div className="team-goals-stack">
                {memberGoals.length === 0 && memberWins.length === 0 && <div className="team-empty-goal">No goals or achievements yet</div>}
                {memberGoals.map((goal) => {
                  const progress = goalProgress(goal);
                  const relatedWinImage = memberWins.find((win) => win.title === goal.title)?.images?.[0] || '';
                  const cover = goal.coverImageData || relatedWinImage || goalCoverImage(goal);
                  return (
                    <div className="team-goal-progress with-cover" key={goal.id}>
                      <div className="team-goal-cover">
                        {cover ? (
                          <button className="image-button" onClick={() => onOpenImage({ src: cover, alt: `${goal.title} cover` })}>
                            <img src={cover} alt={`${goal.title} cover`} />
                          </button>
                        ) : <span>Photo</span>}
                        {goal.memberId === currentUser?.id && (
                          <label className="cover-upload">
                            Edit
                            <input type="file" accept="image/*" onChange={(event) => onGoalCoverChange(goal, event.target.files?.[0])} />
                          </label>
                        )}
                      </div>
                      <div className="team-goal-body">
                        <div className="team-goal-line">
                          <strong>{goal.title}</strong>
                          <span>{progress.percent}%</span>
                        </div>
                        <div className="team-progress-track" aria-label={`${goal.title} progress ${progress.percent}%`}>
                          <i style={{ width: `${progress.percent}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
                {memberWins.map((win) => (
                  <div className="team-goal-progress achievement-row" key={win.id}>
                    <div className="team-goal-cover">
                      {win.images?.[0] ? (
                        <button className="image-button" onClick={() => onOpenImage({ src: win.images[0], alt: `${win.title} achievement` })}>
                          <img src={win.images[0]} alt={`${win.title} achievement`} />
                        </button>
                      ) : <span>Win</span>}
                    </div>
                    <div className="team-goal-body">
                      <div className="team-goal-line">
                        <strong>{win.title}</strong>
                        <span>Achievement</span>
                      </div>
                      {win.note && <p>{win.note}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Goals({ goals, members, currentUser, onToggle, onOpenImage, onAdd, onEdit }) {
  return (
    <div className="section-stack">
      <div className="section-head">
        <h2>Goals</h2>
        <button className="primary" onClick={onAdd}>+ Add goal</button>
      </div>
      {goals.length === 0 && <div className="empty">No goals yet. Add the first milestone timeline.</div>}
      <div className="goal-list">
        {goals.map((goal) => {
          const owner = members.get(goal.memberId) || { name: 'Unknown', color: '#9A4E97' };
          const progress = goalProgress(goal);
          const nearestDeadline = nearestMilestoneDeadline(goal) || goal.deadline;
          const canEdit = goal.memberId === currentUser?.id;
          return (
            <article className={`goal-card ${goal.memberId !== currentUser?.id ? 'locked' : ''}`} key={goal.id}>
              <div className="goal-meta">
                <span className="owner" style={{ '--member-color': owner.color }}><span className="dot" />{owner.name}</span>
                <div className="goal-actions">
                  {canEdit && <button className="text-button" onClick={() => onEdit(goal)}>Edit</button>}
                  <span className={`status ${goalStatus(goal).replace(' ', '-').toLowerCase()}`}>{goalStatus(goal)}</span>
                </div>
              </div>
              <div className="goal-title-row">
                <h3>{goal.title}</h3>
                {isDeadlineNear(nearestDeadline) && <span className="deadline-dot" title="Deadline is near" />}
              </div>
              <div className="goal-subline">
                <span>{progress.done}/{progress.total} steps</span>
                {nearestDeadline && <span>next due {formatDate(nearestDeadline)}</span>}
                <strong>{progress.percent}%</strong>
              </div>
              <Timeline goal={goal} disabled={goal.memberId !== currentUser?.id} onToggle={onToggle} onOpenImage={onOpenImage} />
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Timeline({ goal, disabled, onToggle, onOpenImage }) {
  const progress = goalProgress(goal);
  const fill = progress.total > 1 ? ((Math.max(progress.done - 1, 0) / (progress.total - 1)) * 100) : progress.done ? 100 : 0;
  return (
    <div className="timeline" style={{ '--fill': `${fill}%`, '--nodes': goal.milestones.length }}>
      <div className="track" />
      <div className="nodes">
        {goal.milestones.map((step, index) => {
          const next = !step.done && index === progress.done;
          return (
            <div className="node-wrap" key={step.id}>
              <button
                className={`node ${step.done ? 'done' : ''} ${next ? 'next' : ''}`}
                onClick={() => onToggle(goal, step.id)}
                disabled={disabled}
                title={step.label}
              >
                <span>{step.done ? '✓' : index + 1}</span>
                <em>{step.label}</em>
                {step.deadline && <small>due {formatDate(step.deadline)}</small>}
              </button>
              {step.images?.length > 0 && (
                <div className="node-photos">
                  {step.images.slice(0, 3).map((imageData, imageIndex) => (
                    <button
                      key={imageIndex}
                      type="button"
                      onClick={() => onOpenImage({ src: imageData, alt: `${step.label} milestone` })}
                    >
                      <img src={imageData} alt={`${step.label} milestone`} />
                    </button>
                  ))}
                  {step.images.length > 3 && <strong>+{step.images.length - 3}</strong>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Gallery({ photos, goals, members, currentUser, onAdd, onDelete }) {
  const milestonePhotos = goals.flatMap((goal) => (goal.milestones || []).flatMap((step) => (
    (step.images || []).map((imageData, index) => ({
      id: `${goal.id}-${step.id}-${index}`,
      memberId: goal.memberId,
      caption: `${goal.title} · ${step.label}`,
      imageData,
      createdAt: goal.createdAt,
      source: 'milestone',
    }))
  )));
  const galleryPhotos = [...photos.map((photo) => ({ ...photo, source: 'gallery' })), ...milestonePhotos]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return (
    <div className="section-stack">
      <div className="section-head">
        <h2>Gallery</h2>
        <button className="primary" onClick={onAdd}>Upload photo</button>
      </div>
      {galleryPhotos.length === 0 && <div className="empty">No photos yet.</div>}
      <div className="photo-grid">
        {galleryPhotos.map((photo) => {
          const owner = members.get(photo.memberId) || { name: 'Unknown', color: COLORS[2] };
          return (
            <article className="photo-card" key={photo.id}>
              <img src={photo.imageData} alt={photo.caption || `Uploaded by ${owner.name}`} />
              <div>
                <span>{owner.name}{photo.source === 'milestone' ? ' · Milestone' : ''}</span>
                {photo.caption && <p>{photo.caption}</p>}
                {photo.source === 'gallery' && photo.memberId === currentUser?.id && <button className="text-button" onClick={() => onDelete(photo.id)}>Delete</button>}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function achievementCategory(goal) {
  const text = `${goal.title} ${(goal.milestones || []).map((step) => step.label).join(' ')}`.toLowerCase();
  if (text.includes('education') || text.includes('training') || text.includes('learn')) return '🎓 Education & Learning';
  if (text.includes('sport') || text.includes('health') || text.includes('run')) return '🏃 Health & Sport';
  if (text.includes('travel') || text.includes('trip') || text.includes('adventure')) return '✈️ Travel & Adventure';
  if (text.includes('food') || text.includes('cook') || text.includes('dinner')) return '🍳 Food & Cooking';
  if (text.includes('pet') || text.includes('animal')) return '🐾 Animals & Pets';
  if (text.includes('community') || text.includes('volunteer') || text.includes('kind')) return '❤️ Community & Kindness';
  if (text.includes('creative') || text.includes('hobby') || text.includes('art')) return '🎨 Creativity & Hobbies';
  if (text.includes('family') || text.includes('relationship')) return '👥 Relationships & Family';
  if (text.includes('growth') || text.includes('personal')) return '🌟 Personal Growth';
  return '💰 Milestones & Life';
}

function achievementItems(goals, wins, memberById) {
  const goalItems = goals
    .filter((goal) => goalStatus(goal) === 'Done')
    .map((goal) => {
      const progress = goalProgress(goal);
      const member = memberById.get(goal.memberId) || { name: 'Unknown', color: COLORS[0] };
      return {
        id: `goal-${goal.id}`,
        rawId: goal.id,
        source: 'Goal',
        category: achievementCategory(goal),
        title: goal.title,
        note: `${progress.done}/${progress.total} milestones completed`,
        result: `${progress.total} steps finished`,
        date: completionDate(goal),
        memberId: goal.memberId,
        member,
        images: goalImages(goal),
        imageCount: goalImages(goal).length,
        score: progress.done,
      };
    });
  const manualItems = wins.map((win) => {
    const member = memberById.get(win.memberId) || { name: 'Unknown', color: COLORS[1] };
    return {
      id: `manual-${win.id}`,
      rawId: win.id,
      source: 'Manual win',
      category: win.category || '🌟 Personal Growth',
      title: win.title,
      note: win.note || 'A team win worth celebrating.',
      result: win.note || 'Shared success',
      date: win.date,
      memberId: win.memberId,
      member,
      images: win.images || [],
      imageCount: win.images?.length || 0,
      score: 2,
    };
  });
  return [...goalItems, ...manualItems].sort((a, b) => new Date(b.date) - new Date(a.date));
}

function Achievements({ goals, wins, members, memberById, onAdd, onOpenImage }) {
  const [person, setPerson] = useState('all');
  const [category, setCategory] = useState('all');
  const [year, setYear] = useState('all');
  const items = achievementItems(goals, wins, memberById);
  const filtered = items.filter((item) => (
    (person === 'all' || item.memberId === person) &&
    (category === 'all' || item.category === category) &&
    (year === 'all' || String(new Date(item.date).getFullYear()) === year)
  ));
  const doneGoals = goals.filter((goal) => goalStatus(goal) === 'Done');
  const completedMilestones = goals.flatMap((goal) => goal.milestones || []).filter((step) => step.done).length;
  const winsThisMonth = items.filter((item) => thisMonth(item.date)).length;
  const years = [...new Set(items.map((item) => String(new Date(item.date).getFullYear())))];
  const categories = [...new Set([...ACHIEVEMENT_CATEGORIES, ...items.map((item) => item.category)])];
  const featured = filtered[0] || items[0];
  const badges = [
    { name: 'First Win', unlocked: items.length > 0 },
    { name: 'Goal Crusher', unlocked: doneGoals.length >= 3, detail: `${doneGoals.length}/3 goals` },
    { name: 'Education', unlocked: items.some((item) => item.category === '🎓 Education & Learning') },
    { name: 'Community', unlocked: items.some((item) => item.category === '❤️ Community & Kindness') },
    { name: 'Streak', unlocked: winsThisMonth >= 3, detail: `${winsThisMonth}/3 this month` },
  ];
  const hall = members
    .map((member) => {
      const mine = items.filter((item) => item.memberId === member.id);
      return { member, count: mine.length, top: mine[0] };
    })
    .sort((a, b) => b.count - a.count);

  return (
    <div className="achievements-page">
      <section className="celebration-strip">
        <div>
          <span className="celebration-icon">🏆</span>
          <h2>Achievements unlocked</h2>
          <p>Celebrate what the TA team has already made real.</p>
        </div>
        <div className="celebration-metrics">
          <Metric label="Achievements unlocked" value={items.length} />
          <Metric label="Milestones completed" value={completedMilestones} />
          <Metric label="Wins this month" value={winsThisMonth} />
        </div>
      </section>

      <div className="section-head">
        <h2>Timeline</h2>
        <button className="primary" onClick={onAdd}>+ Add achievement</button>
      </div>

      {featured && (
        <article className="featured-win">
          {featured.images?.[0] ? (
            <button onClick={() => onOpenImage({ src: featured.images[0], alt: featured.title })}>
              <img src={featured.images[0]} alt={featured.title} />
            </button>
          ) : (
            <div className="featured-empty">Achievement</div>
          )}
          <div>
            <span>{featured.source} · {featured.category}</span>
            <h3>{featured.title}</h3>
            <p>{featured.member.name} · {formatDate(featured.date)}</p>
            <strong>{featured.result}</strong>
          </div>
        </article>
      )}

      <div className="achievement-filters">
        <label>by person<select value={person} onChange={(event) => setPerson(event.target.value)}>
          <option value="all">All people</option>
          {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
        </select></label>
        <label>by category<select value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="all">All categories</option>
          {categories.map((item) => <option key={item} value={item}>{item}</option>)}
        </select></label>
        <label>by year<select value={year} onChange={(event) => setYear(event.target.value)}>
          <option value="all">All years</option>
          {years.map((item) => <option key={item} value={item}>{item}</option>)}
        </select></label>
      </div>

      <div className="achievement-timeline">
        {filtered.length === 0 && <div className="empty">No achievements match these filters.</div>}
        {filtered.map((item) => (
          <article className="achievement-entry" key={item.id} style={{ '--member-color': item.member.color }}>
            <div className="achievement-date">{formatDate(item.date)}</div>
            <MiniAvatar member={item.member} />
            <div className="achievement-body">
              <div className="achievement-title-line">
                <h3>{item.title}</h3>
                <span>{item.category}</span>
                <em>{item.source}</em>
              </div>
              <p>{item.result}</p>
              {item.images?.[0] && (
                <button className="achievement-thumb" onClick={() => onOpenImage({ src: item.images[0], alt: item.title })}>
                  <img src={item.images[0]} alt={item.title} />
                  {item.imageCount > 1 && <strong>+{item.imageCount - 1}</strong>}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>

      <section className="badge-grid">
        {badges.map((badge) => (
          <article className={`badge-card ${badge.unlocked ? 'unlocked' : ''}`} key={badge.name}>
            <strong>{badge.unlocked ? '🏅' : '○'}</strong>
            <h3>{badge.name}</h3>
            {badge.detail && <p>{badge.detail}</p>}
          </article>
        ))}
      </section>

      <section className="hall-of-fame">
        <h2>Hall of Fame</h2>
        {hall.map(({ member, count, top }) => (
          <article key={member.id} style={{ '--member-color': member.color }}>
            <MiniAvatar member={member} />
            <strong>{member.name}</strong>
            <span>{count} achievements</span>
            <em>{top?.title || 'No top win yet'}</em>
          </article>
        ))}
      </section>
    </div>
  );
}

function Analytics({ members, goals, wins }) {
  const goalStats = goals.map(goalProgress);
  const average = goalStats.length ? Math.round(goalStats.reduce((sum, item) => sum + item.percent, 0) / goalStats.length) : 0;
  const doneMilestones = goalStats.reduce((sum, item) => sum + item.done, 0);
  const totalMilestones = goalStats.reduce((sum, item) => sum + item.total, 0);
  const doneGoals = goals.filter((goal) => goalStatus(goal) === 'Done').length;
  const statuses = ['Done', 'In progress', 'Not started'].map((status) => ({ status, count: goals.filter((goal) => goalStatus(goal) === status).length }));
  const team = members
    .map((member) => {
      const mine = goals.filter((goal) => goal.memberId === member.id).map(goalProgress);
      const percent = mine.length ? Math.round(mine.reduce((sum, item) => sum + item.percent, 0) / mine.length) : 0;
      return { ...member, percent };
    })
    .sort((a, b) => b.percent - a.percent);
  const leaderboard = members
    .map((member) => {
      const milestones = goals.filter((goal) => goal.memberId === member.id).flatMap((goal) => goal.milestones).filter((step) => step.done).length;
      const memberWins = wins.filter((win) => win.memberId === member.id).length;
      return { ...member, score: milestones + memberWins * 2, milestones, wins: memberWins };
    })
    .sort((a, b) => b.score - a.score);
  const weeks = getWinsByWeek(wins);

  return (
    <div className="analytics-grid">
      <article className="analytics-card progress-card">
        <h3>Overall Progress</h3>
        <Donut percent={average} />
      </article>
      <article className="analytics-card">
        <h3>Key metrics</h3>
        <div className="metric-list">
          <Metric label="Milestones completed" value={`${doneMilestones}/${totalMilestones}`} />
          <Metric label="Goals completed" value={`${doneGoals}/${goals.length}`} />
          <Metric label="Wins logged" value={wins.length} />
        </div>
      </article>
      <article className="analytics-card wide">
        <h3>Team progress</h3>
        <div className="bar-list">
          {team.map((member) => <ProgressBar key={member.id} label={member.name} value={member.percent} color={member.color} />)}
          {team.length === 0 && <p className="muted">No members yet.</p>}
        </div>
      </article>
      <article className="analytics-card wide">
        <h3>Goals by status</h3>
        <Segmented statuses={statuses} total={goals.length} />
      </article>
      <article className="analytics-card">
        <h3>Leaderboard</h3>
        <div className="leaderboard">
          {leaderboard.map((member, index) => (
            <div key={member.id}>
              <span>{['🥇', '🥈', '🥉'][index] || index + 1}</span>
              <strong>{member.name}</strong>
              <em>{member.score} pts</em>
            </div>
          ))}
        </div>
      </article>
      <article className="analytics-card">
        <h3>Wins over time</h3>
        <WeeklyChart weeks={weeks} />
      </article>
    </div>
  );
}

function Donut({ percent }) {
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="donut">
      <svg viewBox="0 0 120 120" role="img" aria-label={`${percent}% overall progress`}>
        <defs>
          <linearGradient id="donutGradient" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#E12B4C" />
            <stop offset="52%" stopColor="#9A4E97" />
            <stop offset="100%" stopColor="#5E6FB6" />
          </linearGradient>
        </defs>
        <circle className="donut-bg" cx="60" cy="60" r={radius} />
        <circle
          className="donut-fg"
          cx="60"
          cy="60"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (percent / 100) * circumference}
        />
      </svg>
      <strong>{percent}%</strong>
    </div>
  );
}

function Metric({ label, value }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}

function ProgressBar({ label, value, color }) {
  return (
    <div className="progress-row" style={{ '--member-color': color }}>
      <span>{label}</span>
      <div><i style={{ width: `${value}%` }} /></div>
      <strong>{value}%</strong>
    </div>
  );
}

function Segmented({ statuses, total }) {
  return (
    <>
      <div className="segment-bar">
        {statuses.map((item) => (
          <i key={item.status} className={item.status.replace(' ', '-').toLowerCase()} style={{ width: `${total ? (item.count / total) * 100 : 0}%` }} />
        ))}
      </div>
      <div className="legend">
        {statuses.map((item) => <span key={item.status}>{item.status}: {item.count}</span>)}
      </div>
    </>
  );
}

function getWinsByWeek(wins) {
  const weeks = Array.from({ length: 6 }, (_, offset) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - start.getDay() - (5 - offset) * 7);
    return { label: `${start.getMonth() + 1}/${start.getDate()}`, count: 0, start };
  });
  wins.forEach((win) => {
    const date = new Date(win.date);
    const slot = weeks.findLast((week) => date >= week.start);
    if (slot) slot.count += 1;
  });
  return weeks;
}

function WeeklyChart({ weeks }) {
  const max = Math.max(1, ...weeks.map((week) => week.count));
  return (
    <div className="weekly-chart">
      {weeks.map((week) => (
        <div key={week.label}>
          <i style={{ height: `${Math.max(8, (week.count / max) * 100)}%` }} />
          <strong>{week.count}</strong>
          <span>{week.label}</span>
        </div>
      ))}
    </div>
  );
}

function Avatar({ member }) {
  return (
    <div className="avatar" style={{ '--member-color': member.color }}>
      {member.avatarData ? <img src={member.avatarData} alt={`${member.name} avatar`} /> : initials(member.name)}
    </div>
  );
}

function MiniAvatar({ member }) {
  return (
    <span className="mini-avatar" style={{ '--member-color': member.color }}>
      {member.avatarData ? <img src={member.avatarData} alt="" /> : initials(member.name)}
    </span>
  );
}

function MemberModal({ member, onSave, onClose }) {
  const [name, setName] = useState(member?.name || '');
  const [role, setRole] = useState(member?.role || '');
  const [color, setColor] = useState(member?.color || COLORS[0]);
  const [avatarData, setAvatarData] = useState(member?.avatarData || '');
  const [busy, setBusy] = useState(false);
  const handleAvatar = async (file) => {
    if (!file) {
      setAvatarData('');
      return;
    }
    setBusy(true);
    setAvatarData(await compressImage(file));
    setBusy(false);
  };
  return (
    <Modal title={member ? 'Edit profile' : 'Add member'} onClose={onClose}>
      <form onSubmit={(event) => { event.preventDefault(); if (name.trim()) onSave({ name: name.trim(), role: role.trim(), color, avatarData }); }}>
        {avatarData && <img className="form-preview avatar-preview" src={avatarData} alt="Member avatar preview" />}
        <label>Name<input value={name} onChange={(event) => setName(event.target.value)} required /></label>
        <label>Role<input value={role} onChange={(event) => setRole(event.target.value)} /></label>
        <label>Photo (optional)<input type="file" accept="image/*" onChange={(event) => handleAvatar(event.target.files?.[0])} /></label>
        {avatarData && <button className="secondary compact-button" type="button" onClick={() => setAvatarData('')}>Remove photo</button>}
        <span className="field-title">Color</span>
        <div className="swatches">{COLORS.map((item) => <button type="button" aria-label={item} className={item === color ? 'selected' : ''} style={{ background: item }} key={item} onClick={() => setColor(item)} />)}</div>
        <ModalActions onClose={onClose} disabled={busy} />
      </form>
    </Modal>
  );
}

function GoalModal({ goal, onSave, onClose }) {
  const [title, setTitle] = useState(goal?.title || '');
  const [deadline, setDeadline] = useState(goal?.deadline || '');
  const [coverImageData] = useState(goal?.coverImageData || '');
  const [milestones, setMilestones] = useState(() => (
    goal?.milestones?.length
      ? goal.milestones.map(normalizeMilestone)
      : [{ id: uid('step'), label: '', deadline: '', images: [], done: false }]
  ));
  const [busy, setBusy] = useState(false);
  const update = (index, patch) => setMilestones(milestones.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  const moveStep = (index, direction) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= milestones.length) return;
    const next = [...milestones];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setMilestones(next);
  };
  const handleStepImages = async (index, files) => {
    const selected = Array.from(files || []);
    if (!selected.length) return;
    setBusy(true);
    const compressed = await Promise.all(selected.map(compressImage));
    update(index, { images: [...(milestones[index].images || []), ...compressed] });
    setBusy(false);
  };
  const clean = milestones
    .map((item) => ({ ...item, label: item.label.trim() }))
    .filter((item) => item.label);
  return (
    <Modal title={goal ? 'Edit goal' : 'Add goal'} onClose={onClose}>
      <form onSubmit={(event) => { event.preventDefault(); if (title.trim() && clean.length) onSave({ title: title.trim(), deadline, milestones: clean, coverImageData }); }}>
        <label>Goal<input value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
        <label>Deadline (optional)<input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} /></label>
        <span className="field-title">Milestones</span>
        <div className="steps">
          {milestones.map((step, index) => (
            <div className="step-editor" key={step.id}>
              <div className="step-fields">
                <input aria-label="Milestone" placeholder="Text" value={step.label} onChange={(event) => update(index, { label: event.target.value })} required={index === 0} />
                <input aria-label="Milestone deadline" type="date" value={step.deadline} onChange={(event) => update(index, { deadline: event.target.value })} />
                <input aria-label="Milestone photos" type="file" accept="image/*" multiple onChange={(event) => handleStepImages(index, event.target.files)} />
              </div>
              <div className="step-tools">
                {step.images?.length > 0 && (
                  <div className="step-preview-grid">
                    {step.images.map((imageData, imageIndex) => (
                      <figure key={`${imageData.slice(0, 24)}-${imageIndex}`}>
                        <img className="form-preview step-preview" src={imageData} alt={`${step.label || 'Milestone'} preview`} />
                        <button type="button" onClick={() => update(index, { images: step.images.filter((_, itemIndex) => itemIndex !== imageIndex) })}>Remove</button>
                      </figure>
                    ))}
                  </div>
                )}
                <button type="button" onClick={() => moveStep(index, -1)} disabled={index === 0}>Move up</button>
                <button type="button" onClick={() => moveStep(index, 1)} disabled={index === milestones.length - 1}>Move down</button>
                <button type="button" onClick={() => setMilestones(milestones.filter((_, itemIndex) => itemIndex !== index))} disabled={milestones.length === 1}>Remove</button>
              </div>
            </div>
          ))}
        </div>
        <button className="secondary" type="button" onClick={() => setMilestones([...milestones, { id: uid('step'), label: '', deadline: '', images: [], done: false }])}>Add step</button>
        <ModalActions onClose={onClose} disabled={busy} />
      </form>
    </Modal>
  );
}

function PhotoModal({ onSave, onClose }) {
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Upload photo" onClose={onClose}>
      <form onSubmit={async (event) => { event.preventDefault(); if (file) { setBusy(true); await onSave({ file, caption: caption.trim() }); } }}>
        <label>Upload photo<input type="file" accept="image/*" onChange={(event) => setFile(event.target.files?.[0] || null)} required /></label>
        <label>Caption (optional)<input value={caption} onChange={(event) => setCaption(event.target.value)} /></label>
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}

function AchievementModal({ members, currentUser, onSave, onClose }) {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [memberId, setMemberId] = useState(currentUser?.id || members[0]?.id || '');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState(ACHIEVEMENT_CATEGORIES[0]);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Add achievement" onClose={onClose}>
      <form onSubmit={async (event) => {
        event.preventDefault();
        if (!title.trim() || !memberId) return;
        setBusy(true);
        await onSave({ title: title.trim(), note: note.trim(), memberId, date, category, files });
      }}>
        <label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
        <label>Description<textarea rows="4" value={note} onChange={(event) => setNote(event.target.value)} /></label>
        <label>Person<select value={memberId} onChange={(event) => setMemberId(event.target.value)} required>
          <option value="">Select person</option>
          {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
        </select></label>
        <label>Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        <label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}>
          {ACHIEVEMENT_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
        </select></label>
        <label>Photos<input type="file" accept="image/*" multiple onChange={(event) => setFiles(Array.from(event.target.files || []))} /></label>
        {files.length > 0 && <span className="muted">{files.length} photos selected</span>}
        <ModalActions onClose={onClose} disabled={busy} />
      </form>
    </Modal>
  );
}

function Lightbox({ image, onClose }) {
  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="lightbox" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <button className="icon-button" onClick={onClose} aria-label="Close">×</button>
      <img src={image.src} alt={image.alt || 'Expanded image'} />
    </div>
  );
}

function Modal({ title, children, onClose }) {
  const box = useRef(null);
  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    box.current?.querySelector('input, textarea, button')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal" ref={box} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalActions({ onClose, disabled = false }) {
  return (
    <div className="modal-actions">
      <button type="button" className="secondary" onClick={onClose}>Cancel</button>
      <button type="submit" className="primary" disabled={disabled}>{disabled ? 'Saving...' : 'Save'}</button>
    </div>
  );
}

function Confetti({ seed }) {
  if (!seed) return null;
  return (
    <div className="confetti" key={seed} aria-hidden="true">
      {Array.from({ length: 28 }, (_, index) => <i key={index} style={{ '--x': `${Math.random() * 100 - 50}vw`, '--delay': `${Math.random() * 0.2}s`, '--color': COLORS[index % COLORS.length] }} />)}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
