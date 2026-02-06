"use server";

import { cookies } from "next/headers";

const PASSCODE_COOKIE_NAME = "passcode_auth";
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

export async function verifyPasscode(passcode: string) {
    const correctPasscode = process.env.AUTH_PASSCODE;

    if (!correctPasscode) {
        console.error("AUTH_PASSCODE is not set in environment variables");
        return { success: false, error: "Server configuration error" };
    }

    if (passcode === correctPasscode) {
        const cookieStore = await cookies();
        cookieStore.set(PASSCODE_COOKIE_NAME, "true", {
            maxAge: THIRTY_DAYS / 1000, // maxAge is in seconds
            path: "/",
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
        });
        return { success: true };
    }

    return { success: false, error: "Helytelen jelkód" };
}

export async function logout() {
    const cookieStore = await cookies();
    cookieStore.delete(PASSCODE_COOKIE_NAME);
}

export async function checkAuth() {
    const cookieStore = await cookies();
    return cookieStore.has(PASSCODE_COOKIE_NAME);
}
