"use client";

import React from "react";
import { logout } from "@/app/actions/auth";

export default function LogoutButton() {
    const handleLogout = async () => {
        await logout();
        window.location.reload();
    };

    return (
        <button
            onClick={handleLogout}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
        >
            Kijelentkezés
        </button>
    );
}
