import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

const FLASH_COOKIE = "_flash";
const ERROR_COOKIE = "_flash_error";

export function setFlash(c: Context, message: string) {
  setCookie(c, FLASH_COOKIE, message, { path: "/", httpOnly: true, maxAge: 60 });
}

export function setFlashError(c: Context, message: string) {
  setCookie(c, ERROR_COOKIE, message, { path: "/", httpOnly: true, maxAge: 60 });
}

export function consumeFlash(c: Context) {
  const flash = getCookie(c, FLASH_COOKIE);
  const error = getCookie(c, ERROR_COOKIE);
  if (flash) deleteCookie(c, FLASH_COOKIE, { path: "/" });
  if (error) deleteCookie(c, ERROR_COOKIE, { path: "/" });
  return { flash, error };
}
