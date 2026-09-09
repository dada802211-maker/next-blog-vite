import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
type User = { id: number; name: string; email: string }
type Post = { id: number; title: string; content: string; image: string; published: number; author: string; author_id: number; created_at: string }
let csrf = ''
async function api<T>(path: string, method = 'GET', body?: FormData): Promise<T> {
 const r = await fetch(`/api${path}`, { method, headers: method === 'GET' ? {} : { 'X-CSRF-Token': csrf }, body })
 const text = await r.text()
 let data
 try { data = text ? JSON.parse(text) : null } catch { data = null }
 if (!r.ok) {
  if ([502, 503, 504].includes(r.status)) throw new Error('サーバーに接続できません。しばらくしてから再読み込みしてください。')
  throw new Error(data?.error || `通信に失敗しました（HTTP ${r.status}）。`)
 }
 if (data === null) throw new Error('サーバーから正しい応答を受信できませんでした。再読み込みしてください。')
 return data as T
}
const route = () => location.hash.slice(1) || '/'
const date = (v: string) => new Date(v).toLocaleDateString('ja-JP')
export default function App() {
 const [page, setPage] = useState(route)
 const [user, setUser] = useState<User | null>(null)
 const [ready, setReady] = useState(false)
 const [error, setError] = useState('')
 const [busy, setBusy] = useState(false)
 const [loading, setLoading] = useState(true)
 const [posts, setPosts] = useState<Post[]>([])
 const [post, setPost] = useState<Post | null>(null)
 const [search, setSearch] = useState('')
 const [revision, setRevision] = useState(0)
 useEffect(() => { const fn = () => { setPage(route()); setError('') }; window.addEventListener('hashchange', fn); return () => window.removeEventListener('hashchange', fn) }, [])
 useEffect(() => { api<{ user: User | null; csrf: string }>('/session').then(s => { setUser(s.user); csrf = s.csrf }).catch(e => setError(e.message)).finally(() => setReady(true)) }, [])
 useEffect(() => {
  let active = true
  const load = async () => {
   setLoading(true); setPost(null)
   try {
    if (page === '/' || page === '/dashboard') { const result = await api<Post[]>(`/posts?mine=${page === '/dashboard' ? '1' : '0'}&search=${encodeURIComponent(search)}`); if(active) setPosts(result) }
    else if (/^\/posts\/\d+(\/edit)?$/.test(page)) { const p = await api<Post>(`/posts/${page.split('/')[2]}`); if(active) setPost(p) }
   } catch(e) { if(active) setError(e instanceof Error ? e.message : '読み込みに失敗しました。') }
   finally { if(active) setLoading(false) }
  }
  if(ready) void load()
  return () => { active = false }
 }, [page, search, revision, ready])
 async function act(fn: () => Promise<void>) { setError(''); setBusy(true); try { await fn() } catch(e) { setError(e instanceof Error ? e.message : '通信に失敗しました。') } finally { setBusy(false) } }
 function submit(e: FormEvent<HTMLFormElement>, fn: (data: FormData) => Promise<void>) { e.preventDefault(); const data = new FormData(e.currentTarget); void act(() => fn(data)) }
 const privatePage = page === '/dashboard' || page === '/create' || page.endsWith('/edit')
 const editor = page === '/create' || page.endsWith('/edit')
 return <><header><a className="brand" href="#/">Blog<span> / JOURNAL</span></a><nav><a href="#/">記事一覧</a><a href="#/about">このブログについて</a><a href="#/contacts">お問い合わせ</a>{user ? <><a href="#/dashboard">マイページ</a><button className="quiet" disabled={busy} onClick={() => void act(async () => { await api('/logout','POST'); setUser(null); location.hash = '/'; setRevision(v => v+1) })}>ログアウト</button></> : <><a href="#/login">ログイン</a><a className="button small" href="#/register">新規登録</a></>}</nav></header><main>
 {error && <div className="error" role="alert">{error}</div>}
 {!ready ? <p role="status">接続しています…</p> : privatePage && !user ? <section className="panel"><h1>ログインが必要です</h1><p>自分の記事を管理するにはログインしてください。</p><a className="button" href="#/login">ログインへ</a></section> : <>
 {(page === '/' || page === '/dashboard') && <><section className="hero"><p className="eyebrow">{page === '/' ? 'IDEAS, STORIES & EVERYDAY DISCOVERIES' : 'YOUR PERSONAL SPACE'}</p><h1>{page === '/' ? <>学びをつづる。<br/>発見を、分かち合う。</> : `${user?.name}さんの記事`}</h1><p>{page === '/' ? '日々の気づきや、新しいアイデアを。あなたの言葉が、誰かの次の一歩になる。' : '書きかけのアイデアも、公開したストーリーも、ここから。'}</p>{user && <a className="button" href="#/create">＋ 記事を書く</a>}</section><div className="listHeading"><div><span className="eyebrow">JOURNAL</span><h2>{page === '/' ? '最新の記事' : '記事の管理'}</h2></div><label className="search">記事を検索<input type="search" placeholder="キーワードを入力…" value={search} onChange={e => setSearch(e.target.value)}/></label></div>{loading ? <p role="status">記事を読み込み中…</p> : posts.length === 0 ? <section className="empty"><h2>{search ? '一致する記事がありません' : 'まだ記事がありません'}</h2><p>{search ? '別のキーワードで検索してみてください。' : '最初の記事で、あなたの発見を共有しましょう。'}</p><a href={user ? '#/create' : '#/register'}>{user ? '記事を書く →' : '登録して記事を書く →'}</a></section> : <div className="grid">{posts.map(p => <article className="card" key={p.id}><a className="cover" href={`#/posts/${p.id}`}>{p.image ? <img src={p.image} alt="" loading="lazy"/> : <div className="placeholder"><span>Blog.</span><small>THOUGHTS INTO WORDS</small></div>}</a><div className="cardBody"><div className="meta"><time>{date(p.created_at)}</time><span>{p.published ? '公開' : '下書き'}</span></div><h2><a href={`#/posts/${p.id}`}>{p.title}</a></h2><p className="excerpt">{p.content}</p><div className="cardFooter"><span>{p.author}</span><a href={`#/posts/${p.id}`}>続きを読む ↗</a></div>{page === '/dashboard' && <div className="actions"><a href={`#/posts/${p.id}/edit`}>編集</a><button className="danger" disabled={busy} onClick={() => { if(confirm('この記事を削除しますか？')) void act(async () => { await api(`/posts/${p.id}`,'DELETE'); setRevision(v => v+1) }) }}>削除</button></div>}</div></article>)}</div>}</>}
 {(page === '/login' || page === '/register') && <section className="panel narrow"><p className="eyebrow">WELCOME TO BLOG</p><h1>{page === '/register' ? 'アカウントを作成' : 'おかえりなさい'}</h1><form key={page} onSubmit={e => submit(e,async data => { const u = await api<User>(page,'POST',data); setUser(u); location.hash='/dashboard' })}>{page === '/register' && <label>名前<input name="name" required maxLength={80} autoComplete="name"/></label>}<label>メールアドレス<input name="email" type="email" required maxLength={254} autoComplete="email"/></label><label>パスワード<input name="password" type="password" required minLength={8} maxLength={32} autoComplete={page === '/register' ? 'new-password' : 'current-password'}/></label>{page === '/register' && <label>パスワード（確認）<input name="confirmPassword" type="password" required minLength={8} maxLength={32} autoComplete="new-password"/></label>}<button disabled={busy}>{busy ? '処理中…' : page === '/register' ? '登録する' : 'ログイン'}</button></form><p><a href={page === '/register' ? '#/login' : '#/register'}>{page === '/register' ? 'アカウントをお持ちの方はこちら' : '新規登録はこちら'}</a></p></section>}
 {editor && (loading ? <p>読み込み中…</p> : (page === '/create' || post) && <section className="panel editor"><p className="eyebrow">WRITE YOUR STORY</p><h1>{post ? '記事を編集' : '新しい記事'}</h1><form key={post?.id || 'new'} onSubmit={e => submit(e,async data => { const p = await api<Post>(post ? `/posts/${post.id}` : '/posts','POST',data); location.hash=`/posts/${p.id}` })}><label>タイトル<input name="title" required minLength={3} maxLength={255} defaultValue={post?.title} placeholder="伝えたいことを、ひとことで"/></label><label>本文<textarea name="content" required minLength={10} maxLength={100000} rows={14} defaultValue={post?.content} placeholder="ここからストーリーを始めましょう。"/></label><label>カバー画像（JPEG / PNG / WebP / GIF、5MB以下）<input type="file" name="image" accept="image/jpeg,image/png,image/webp,image/gif"/></label>{post?.image && <><img className="preview" src={post.image} alt="現在のカバー"/><label className="check"><input type="checkbox" name="removeImage" value="1"/>現在の画像を削除する</label></>}<label>公開設定<select name="published" defaultValue={post?.published ?? 1}><option value="1">公開する</option><option value="0">下書きとして保存</option></select></label><div className="actions"><button disabled={busy}>{busy ? '保存中…' : '記事を保存'}</button><a href="#/dashboard">キャンセル</a></div></form></section>)}
 {/^\/posts\/\d+$/.test(page) && (loading ? <p>読み込み中…</p> : post && <article className="reading"><a href="#/">← 記事一覧</a><div className="meta"><time>{date(post.created_at)}</time><span>{post.author} · {post.published ? '公開' : '下書き'}</span></div><h1>{post.title}</h1>{user?.id === post.author_id && <a href={`#/posts/${post.id}/edit`}>この記事を編集 →</a>}{post.image && <img className="articleImage" src={post.image} alt="記事のカバー"/>}<div className="prose">{post.content}</div></article>)}
 {page === '/about' && <section className="panel reading"><p className="eyebrow">ABOUT</p><h1>日々の学びを、<br/>未来の誰かへ。</h1><p>Blog は、学んだことや日常の発見を、自分の言葉で残す場所です。</p><p>記事を読んで新しい視点に出会ったら、今度はあなたのストーリーを聞かせてください。</p><a className="button" href={user ? '#/create' : '#/register'}>書きはじめる</a></section>}
 {page === '/contacts' && <section className="panel narrow"><p className="eyebrow">CONTACT</p><h1>お問い合わせ</h1><p>ご意見やご質問をお寄せください。</p><form onSubmit={e => submit(e,async data => { await api('/contacts','POST',data); location.hash='/contacts/complete' })}><label>名前<input name="name" required minLength={3} maxLength={20}/></label><label>メールアドレス<input name="email" type="email" required maxLength={254}/></label><label>お問い合わせ内容<textarea name="message" rows={6} required maxLength={5000}/></label><button disabled={busy}>{busy ? '送信中…' : '送信する'}</button></form></section>}
 {page === '/contacts/complete' && <section className="panel narrow"><h1>お問い合わせを受け付けました</h1><p>内容を保存しました。ありがとうございます。</p><a href="#/">記事一覧に戻る →</a></section>}
 {!['/','/dashboard','/create','/login','/register','/about','/contacts','/contacts/complete'].includes(page) && !/^\/posts\/\d+(\/edit)?$/.test(page) && <section className="empty"><h1>404</h1><p>ページが見つかりません。</p><a href="#/">トップへ戻る</a></section>}
 </> }</main><footer><a className="brand" href="#/">Blog.</a><span>学びと発見を、あなたの言葉で。</span><small>© {new Date().getFullYear()} Blog</small></footer></>
}


