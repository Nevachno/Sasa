import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';
const DEMO_MODE = process.env.DEMO_MODE !== 'false';
const JWT_SECRET = process.env.JWT_SECRET || 'development-only-secret-change-before-production';
const UPLOAD_DIR = path.resolve(__dirname, process.env.UPLOAD_DIR || 'uploads');
const DATA_DIR = path.join(__dirname, '.data');
const DATA_FILE = path.join(DATA_DIR, 'demo.json');
const allowedOrigins = new Set([process.env.APP_ORIGIN || `http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`]);

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });

const now = Date.now();
const minutesAgo = (value) => new Date(now - value * 60_000).toISOString();
const daysAgo = (value) => new Date(now - value * 86_400_000).toISOString();
const uid = () => crypto.randomUUID();

function seedData() {
  return {
    users: [
      { id: 'u-viewer', username: 'mira_viewer', email: 'viewer@sasavot.local', displayName: 'Мира', passwordHash: bcrypt.hashSync('viewer123!', 12), role: 'Пользователь', avatar: 'М', xp: 1840, level: 8, rating: 642, followers: 128, following: 43, reactionsReceived: 2310, views: 18420, bio: 'Снимаю живые моменты и собираю лучшие шутки со стримов.', joinedAt: daysAgo(286), verified: false },
      { id: 'u-author', username: 'melnikova', email: 'author@sasavot.local', displayName: 'Лера Мельникова', passwordHash: bcrypt.hashSync('author123!', 12), role: 'Проверенный автор', avatar: 'Л', xp: 4280, level: 14, rating: 1387, followers: 2406, following: 81, reactionsReceived: 16240, views: 280400, bio: 'Монтажи, афиши и немного хаоса. Делаю красиво с 2023.', joinedAt: daysAgo(814), verified: true },
      { id: 'u-irl', username: 'maks.onair', email: 'maks@sasavot.local', displayName: 'Макс', passwordHash: bcrypt.hashSync('author123!', 12), role: 'Автор', avatar: 'М', xp: 2950, level: 11, rating: 948, followers: 987, following: 116, reactionsReceived: 7082, views: 119300, bio: 'IRL, поездки и случайные встречи.', joinedAt: daysAgo(504), verified: false },
      { id: 'u-meme', username: 'ded_inside_out', email: 'meme@sasavot.local', displayName: 'дед инсайд вышел', passwordHash: bcrypt.hashSync('author123!', 12), role: 'Активный участник', avatar: 'Д', xp: 2330, level: 10, rating: 814, followers: 640, following: 202, reactionsReceived: 5214, views: 88390, bio: 'Мемы появляются быстрее, чем я успеваю их объяснить.', joinedAt: daysAgo(392), verified: false },
      { id: 'u-mod', username: 'mod.ksenia', email: 'mod@sasavot.local', displayName: 'Ксения', passwordHash: bcrypt.hashSync('mod12345!', 12), role: 'Модератор', avatar: 'К', xp: 6100, level: 18, rating: 1702, followers: 3110, following: 54, reactionsReceived: 20810, views: 306800, bio: 'Слежу, чтобы здесь было шумно, но безопасно.', joinedAt: daysAgo(1098), verified: true },
      { id: 'u-admin', username: 'admin.sasavot', email: 'admin@sasavot.local', displayName: 'Администратор', passwordHash: bcrypt.hashSync('admin12345!', 12), role: 'Администратор', avatar: 'А', xp: 9200, level: 24, rating: 2640, followers: 7480, following: 22, reactionsReceived: 42600, views: 710000, bio: 'Команда SASAVOT Community.', joinedAt: daysAgo(1320), verified: true }
    ],
    posts: [
      { id: 'p-night', userId: 'u-author', category: 'IRL', title: 'Встретились после эфира', body: 'Собрали маленькую встречу в Москве. Вышло громче и теплее, чем планировали. Кто был, отмечайтесь.', media: '/assets/images/community-night.png', mediaType: 'image', createdAt: minutesAgo(38), views: 12840, featured: true, reactions: { fire: 1247, heart: 486, laugh: 93, skull: 41 }, comments: 84, tags: ['irl', 'sasavot', 'встреча'] },
      { id: 'p-art', userId: 'u-author', category: 'Творчество', title: 'Эфир глазами комьюнити', body: 'Постер из стоп-кадров, ксерокса и ночного кофе. Полная версия для заставки лежит в профиле.', media: '/assets/images/fan-art.png', mediaType: 'image', createdAt: minutesAgo(112), views: 8921, featured: false, reactions: { fire: 821, heart: 309, laugh: 22, skull: 13 }, comments: 47, tags: ['art', 'design', 'sasavot'] },
      { id: 'p-clip', userId: 'u-irl', category: 'Клипы', title: 'Тот самый финал катки', body: 'За десять секунд прошли все стадии принятия. Звук лучше не убавлять.', media: '/assets/images/community-night.png', mediaType: 'video', duration: '00:18', createdAt: minutesAgo(247), views: 22418, featured: false, reactions: { fire: 641, heart: 114, laugh: 783, skull: 208 }, comments: 126, tags: ['clip', 'лучшее'] },
      { id: 'p-meme', userId: 'u-meme', category: 'Мемы', title: 'Когда стрим начался вовремя', body: 'Историческая реконструкция события, которого никто не видел.', media: '/assets/images/fan-art.png', mediaType: 'image', createdAt: minutesAgo(411), views: 18702, featured: false, reactions: { fire: 266, heart: 84, laugh: 1109, skull: 502 }, comments: 91, tags: ['мем', 'база'] },
      { id: 'p-tiktok', userId: 'u-irl', category: 'TikTok', title: 'Случайная встреча в Питере', body: 'Дождь, один зонт на троих и лучший спонтанный мини-влог этого месяца.', media: '/assets/images/community-night.png', mediaType: 'video', duration: '00:31', createdAt: daysAgo(1), views: 31450, featured: true, reactions: { fire: 993, heart: 728, laugh: 131, skull: 29 }, comments: 164, tags: ['tiktok', 'irl', 'питер'] }
    ],
    comments: [
      { id: 'c1', postId: 'p-night', userId: 'u-viewer', body: 'Это было очень живо. Спасибо всем, кто пришёл!', createdAt: minutesAgo(28), parentId: null },
      { id: 'c2', postId: 'p-night', userId: 'u-irl', body: '@mira_viewer в следующий раз делаем ещё одну общую фотку.', createdAt: minutesAgo(17), parentId: 'c1' },
      { id: 'c3', postId: 'p-art', userId: 'u-meme', body: 'Обложка выглядит как альбом, который я уже хочу послушать.', createdAt: minutesAgo(61), parentId: null }
    ],
    bookmarks: [],
    reactions: [],
    follows: [{ followerId: 'u-viewer', followingId: 'u-author' }],
    notifications: [
      { id: 'n1', userId: 'u-viewer', text: 'melnikova оценила вашу публикацию', type: 'reaction', read: false, createdAt: minutesAgo(9) },
      { id: 'n2', userId: 'u-viewer', text: 'Ваш комментарий получил 18 реакций', type: 'comment', read: false, createdAt: minutesAgo(54) },
      { id: 'n3', userId: 'u-viewer', text: 'Новый пост автора maks.onair', type: 'follow', read: true, createdAt: daysAgo(1) }
    ],
    reports: [
      { id: 'r1', reporterId: 'u-viewer', postId: 'p-meme', reason: 'Неверная категория', details: 'Похоже на монтаж, а не мем.', status: 'Открыта', priority: 34, createdAt: minutesAgo(72) }
    ],
    moderationLog: []
  };
}

function loadStore() {
  if (DEMO_MODE && fs.existsSync(DATA_FILE)) {
    try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { /* reset malformed demo data */ }
  }
  return seedData();
}

let store = loadStore();
const persist = () => {
  if (!DEMO_MODE) return;
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
};

const publicUser = (user) => {
  if (!user) return null;
  const { passwordHash, email, ...safe } = user;
  return safe;
};
const getUser = (id) => store.users.find((user) => user.id === id);
const postPayload = (post, viewerId) => ({
  ...post,
  author: publicUser(getUser(post.userId)),
  viewerReaction: store.reactions.find((item) => item.userId === viewerId && item.postId === post.id)?.type || null,
  bookmarked: store.bookmarks.some((item) => item.userId === viewerId && item.postId === post.id),
  following: store.follows.some((item) => item.followerId === viewerId && item.followingId === post.userId)
});

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      mediaSrc: ["'self'", 'blob:'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      upgradeInsecureRequests: IS_PROD ? [] : null
    }
  },
  strictTransportSecurity: IS_PROD ? { maxAge: 31_536_000, includeSubDomains: true } : false,
  crossOriginResourcePolicy: { policy: 'same-origin' }
}));
app.use(express.json({ limit: '512kb' }));
app.use(express.urlencoded({ extended: false, limit: '512kb' }));
app.use(cookieParser());

const apiLimiter = rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: true, legacyHeaders: false });
app.use('/api', apiLimiter);

function readToken(req) {
  try { return jwt.verify(req.cookies.sasavot_session, JWT_SECRET); } catch { return null; }
}
function attachUser(req, _res, next) {
  const token = readToken(req);
  req.user = token ? getUser(token.sub) : null;
  next();
}
function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Войдите, чтобы продолжить.' });
  if (req.user.bannedUntil && new Date(req.user.bannedUntil) > new Date()) return res.status(403).json({ error: 'Аккаунт временно заблокирован.' });
  next();
}
function requireRole(...roles) {
  return (req, res, next) => roles.includes(req.user?.role) ? next() : res.status(403).json({ error: 'Недостаточно прав.' });
}
function sameOrigin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (origin && !allowedOrigins.has(origin)) return res.status(403).json({ error: 'Запрос отклонён.' });
  next();
}
app.use('/api', attachUser, sameOrigin);

app.get('/api/health', (_req, res) => res.json({ ok: true, demoMode: DEMO_MODE, timestamp: new Date().toISOString() }));

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const identity = String(req.body.identity || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const user = store.users.find((item) => item.email.toLowerCase() === identity || item.username.toLowerCase() === identity);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: 'Неверный логин или пароль.' });
  const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: req.body.remember ? '30d' : '12h', issuer: 'sasavot-community' });
  res.cookie('sasavot_session', token, { httpOnly: true, sameSite: 'strict', secure: IS_PROD, maxAge: req.body.remember ? 2_592_000_000 : 43_200_000 });
  res.json({ user: publicUser(user) });
});

app.post('/api/auth/register', authLimiter, async (req, res) => {
  const username = String(req.body.username || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!/^[a-zA-Z0-9_.]{3,24}$/.test(username)) return res.status(400).json({ error: 'Username: 3-24 символа, латиница, цифры, точка или подчёркивание.' });
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 10) return res.status(400).json({ error: 'Проверьте email. Пароль должен содержать не менее 10 символов.' });
  if (store.users.some((item) => item.username.toLowerCase() === username.toLowerCase() || item.email === email)) return res.status(409).json({ error: 'Такой пользователь уже существует.' });
  const user = { id: uid(), username, email, displayName: username, passwordHash: await bcrypt.hash(password, 12), role: 'Пользователь', avatar: username[0].toUpperCase(), xp: 40, level: 1, rating: 0, followers: 0, following: 0, reactionsReceived: 0, views: 0, bio: '', joinedAt: new Date().toISOString(), verified: false };
  store.users.push(user);
  persist();
  res.status(201).json({ message: 'Аккаунт создан. Подтвердите email перед публикацией.', user: publicUser(user) });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('sasavot_session');
  res.status(204).end();
});

app.get('/api/session', (req, res) => res.json({ user: publicUser(req.user), demoMode: DEMO_MODE }));

app.get('/api/feed', (req, res) => {
  const category = String(req.query.category || 'Все');
  const mode = String(req.query.mode || 'Для тебя');
  let posts = store.posts.filter((post) => category === 'Все' || post.category === category);
  if (mode === 'Новое') posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (mode === 'Популярное') posts.sort((a, b) => (Object.values(b.reactions).reduce((s, n) => s + n, 0) + b.views / 40) - (Object.values(a.reactions).reduce((s, n) => s + n, 0) + a.views / 40));
  if (mode === 'Подписки' && req.user) posts = posts.filter((post) => store.follows.some((follow) => follow.followerId === req.user.id && follow.followingId === post.userId));
  res.json({ posts: posts.map((post) => postPayload(post, req.user?.id)) });
});

app.get('/api/posts/:id/comments', (req, res) => {
  const comments = store.comments.filter((item) => item.postId === req.params.id).map((item) => ({ ...item, author: publicUser(getUser(item.userId)) }));
  res.json({ comments });
});

app.post('/api/posts/:id/comments', requireAuth, (req, res) => {
  const body = String(req.body.body || '').trim().slice(0, 2000);
  const parentId = req.body.parentId || null;
  if (!body) return res.status(400).json({ error: 'Комментарий не может быть пустым.' });
  if (parentId) {
    const parent = store.comments.find((item) => item.id === parentId && item.postId === req.params.id);
    if (!parent) return res.status(404).json({ error: 'Комментарий не найден.' });
  }
  const comment = { id: uid(), postId: req.params.id, userId: req.user.id, body, parentId, createdAt: new Date().toISOString() };
  store.comments.push(comment);
  const post = store.posts.find((item) => item.id === req.params.id);
  if (post) post.comments += 1;
  persist();
  res.status(201).json({ comment: { ...comment, author: publicUser(req.user) } });
});

app.put('/api/posts/:id/reaction', requireAuth, (req, res) => {
  const type = String(req.body.type || '');
  if (!['heart', 'laugh', 'fire', 'skull', 'clown'].includes(type)) return res.status(400).json({ error: 'Неизвестная реакция.' });
  const post = store.posts.find((item) => item.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Публикация не найдена.' });
  const existing = store.reactions.find((item) => item.postId === post.id && item.userId === req.user.id);
  const toggledOff = existing?.type === type;
  if (toggledOff) {
    store.reactions = store.reactions.filter((item) => item !== existing);
    post.reactions[type] = Math.max(0, (post.reactions[type] || 0) - 1);
  } else {
    if (existing) post.reactions[existing.type] = Math.max(0, (post.reactions[existing.type] || 0) - 1);
    if (existing) existing.type = type; else store.reactions.push({ userId: req.user.id, postId: post.id, type });
    post.reactions[type] = (post.reactions[type] || 0) + 1;
  }
  persist();
  res.json({ reactions: post.reactions, viewerReaction: toggledOff ? null : type });
});

app.put('/api/posts/:id/bookmark', requireAuth, (req, res) => {
  const match = store.bookmarks.find((item) => item.postId === req.params.id && item.userId === req.user.id);
  if (match) store.bookmarks = store.bookmarks.filter((item) => item !== match);
  else store.bookmarks.push({ userId: req.user.id, postId: req.params.id, createdAt: new Date().toISOString() });
  persist();
  res.json({ bookmarked: !match });
});

app.put('/api/users/:id/follow', requireAuth, (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Нельзя подписаться на себя.' });
  const match = store.follows.find((item) => item.followerId === req.user.id && item.followingId === req.params.id);
  if (match) store.follows = store.follows.filter((item) => item !== match);
  else store.follows.push({ followerId: req.user.id, followingId: req.params.id });
  persist();
  res.json({ following: !match });
});

app.post('/api/posts/:id/report', requireAuth, (req, res) => {
  if (store.reports.some((item) => item.postId === req.params.id && item.reporterId === req.user.id)) return res.status(409).json({ error: 'Вы уже отправили жалобу на эту публикацию.' });
  const report = { id: uid(), reporterId: req.user.id, postId: req.params.id, reason: String(req.body.reason || 'Другое').slice(0, 80), details: String(req.body.details || '').slice(0, 600), status: 'Открыта', priority: 20, createdAt: new Date().toISOString() };
  store.reports.push(report);
  persist();
  res.status(201).json({ message: 'Жалоба отправлена модераторам.' });
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: Number(process.env.MAX_UPLOAD_MB || 80) * 1024 * 1024, files: 1 } });
function sniffMime(buffer) {
  const hex = buffer.subarray(0, 12).toString('hex');
  if (hex.startsWith('ffd8ff')) return 'image/jpeg';
  if (hex.startsWith('89504e470d0a1a0a')) return 'image/png';
  if (hex.startsWith('52494646') && hex.slice(16, 24) === '57454250') return 'image/webp';
  if (buffer.subarray(4, 8).toString() === 'ftyp') return 'video/mp4';
  if (hex.startsWith('1a45dfa3')) return 'video/webm';
  return null;
}

app.post('/api/posts', requireAuth, upload.single('media'), (req, res) => {
  const category = String(req.body.category || 'Другое');
  if (!['TikTok', 'Клипы', 'IRL', 'Творчество', 'Мемы', 'Другое'].includes(category)) return res.status(400).json({ error: 'Выберите корректную категорию.' });
  let media = null;
  let mediaType = null;
  if (req.file) {
    const mime = sniffMime(req.file.buffer);
    if (!mime) return res.status(415).json({ error: 'Формат файла не поддерживается.' });
    const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/webm': 'webm' }[mime];
    const filename = `${crypto.randomBytes(24).toString('hex')}.${extension}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), req.file.buffer, { mode: 0o640 });
    media = `/uploads/${filename}`;
    mediaType = mime.startsWith('image') ? 'image' : 'video';
  }
  const post = { id: uid(), userId: req.user.id, category, title: String(req.body.title || '').trim().slice(0, 120), body: String(req.body.body || '').trim().slice(0, 4000), media, mediaType, createdAt: new Date().toISOString(), views: 0, featured: false, reactions: { fire: 0, heart: 0, laugh: 0, skull: 0 }, comments: 0, tags: String(req.body.tags || '').split(/[,\s]+/).map((tag) => tag.replace(/^#/, '')).filter(Boolean).slice(0, 8) };
  if (!post.title || !post.body) return res.status(400).json({ error: 'Добавьте название и описание.' });
  store.posts.unshift(post);
  req.user.xp += 40;
  persist();
  res.status(201).json({ post: postPayload(post, req.user.id) });
});

app.get('/api/search', (req, res) => {
  const query = String(req.query.q || '').trim().toLowerCase();
  if (query.length < 2) return res.json({ posts: [], users: [], tags: [] });
  const users = store.users.filter((user) => `${user.username} ${user.displayName}`.toLowerCase().includes(query)).slice(0, 6).map(publicUser);
  const posts = store.posts.filter((post) => `${post.title} ${post.body} ${post.tags.join(' ')}`.toLowerCase().includes(query)).slice(0, 8).map((post) => postPayload(post, req.user?.id));
  const tags = [...new Set(store.posts.flatMap((post) => post.tags))].filter((tag) => tag.toLowerCase().includes(query)).slice(0, 8);
  res.json({ posts, users, tags });
});

app.get('/api/users/:username', (req, res) => {
  const user = store.users.find((item) => item.username === req.params.username);
  if (!user) return res.status(404).json({ error: 'Профиль не найден.' });
  res.json({ user: publicUser(user), posts: store.posts.filter((post) => post.userId === user.id).map((post) => postPayload(post, req.user?.id)), following: store.follows.some((item) => item.followerId === req.user?.id && item.followingId === user.id) });
});

app.patch('/api/profile', requireAuth, (req, res) => {
  const displayName = String(req.body.displayName || '').trim().slice(0, 48);
  const bio = String(req.body.bio || '').trim().slice(0, 280);
  if (displayName.length < 2) return res.status(400).json({ error: 'Имя должно содержать не менее 2 символов.' });
  req.user.displayName = displayName;
  req.user.bio = bio;
  persist();
  res.json({ user: publicUser(req.user) });
});

app.get('/api/notifications', requireAuth, (req, res) => res.json({ notifications: store.notifications.filter((item) => item.userId === req.user.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) }));

app.get('/api/moderation/reports', requireAuth, requireRole('Модератор', 'Старший модератор', 'Администратор', 'Владелец'), (_req, res) => {
  res.json({ reports: store.reports.map((report) => ({ ...report, post: store.posts.find((post) => post.id === report.postId), reporter: publicUser(getUser(report.reporterId)) })).sort((a, b) => b.priority - a.priority) });
});

app.patch('/api/moderation/reports/:id', requireAuth, requireRole('Модератор', 'Старший модератор', 'Администратор', 'Владелец'), (req, res) => {
  const report = store.reports.find((item) => item.id === req.params.id);
  if (!report) return res.status(404).json({ error: 'Жалоба не найдена.' });
  const action = String(req.body.action || 'resolve');
  report.status = action === 'reject' ? 'Отклонена' : 'Решена';
  if (action === 'hide') {
    const post = store.posts.find((item) => item.id === report.postId);
    if (post) post.hidden = true;
  }
  store.moderationLog.push({ id: uid(), moderatorId: req.user.id, reportId: report.id, action, createdAt: new Date().toISOString() });
  persist();
  res.json({ report });
});

app.post('/api/demo/reset', (req, res) => {
  if (!DEMO_MODE) return res.status(404).end();
  store = seedData();
  persist();
  res.json({ ok: true });
});

app.use('/uploads', express.static(UPLOAD_DIR, { dotfiles: 'deny', index: false, immutable: true, maxAge: '7d', setHeaders: (res) => res.setHeader('Content-Disposition', 'inline') }));
app.use('/vendor/phosphor', express.static(path.join(__dirname, 'node_modules/@phosphor-icons/web/src'), { maxAge: '30d' }));
app.use(express.static(__dirname, { dotfiles: 'deny', extensions: ['html'], maxAge: IS_PROD ? '1h' : 0 }));
app.get('*path', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.use((error, _req, res, _next) => {
  console.error(error);
  if (error instanceof multer.MulterError) return res.status(413).json({ error: 'Файл превышает допустимый размер.' });
  res.status(500).json({ error: IS_PROD ? 'Внутренняя ошибка сервера.' : error.message });
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(PORT, () => console.log(`SASAVOT Community: http://localhost:${PORT}`));
}

export { app, seedData };
