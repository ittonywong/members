/*
 * 會員網站設定檔 — 只需要改呢個檔案。
 * Members site configuration — this is the ONLY file you need to edit.
 *
 * 1) SUPABASE_URL      ：Supabase「Project URL」，例如 https://abcdefghijklmnop.supabase.co
 * 2) SUPABASE_ANON_KEY ：Supabase「Publishable key」（sb_publishable_ 開頭）
 *                         或舊式「anon public」key（eyJ 開頭）。
 *
 * ⚠️ 絕對唔好放 secret key（sb_secret_…）或 service_role key！
 *    呢兩條 key 可以繞過所有保安，放入網頁 = 將成個資料庫交俾人。
 *    （網站會自動偵測並拒絕使用佢哋。）
 *
 * 3) PRIVACY_CONTACT   ：私隱聲明入面，會員要求查閱／更正／刪除資料時聯絡嘅電郵。
 */
window.MEMBERS_CONFIG = {
  SUPABASE_URL: "https://jdycdlbhmihtafxgfade.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_xbJCafXmuUjpXxjqAcabYA_ntB5-tEY",
  PRIVACY_CONTACT: "tonaitest202601@gmail.com",
  MIN_PASSWORD_LENGTH: 8
};
