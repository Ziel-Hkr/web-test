# FixDorm

FixDorm is a responsive dormitory maintenance MVP. Residents can file repair reports, helpdesk staff can verify and assign the right technician, and technicians can accept jobs and update their progress. Each report keeps a chronological status history.

## Try the preview

Run the app without environment variables to explore the role-specific demo dashboards. Demo reports are stored in the current browser only; this mode is for previewing the workflow and is not shared between users.

The account menu lets you switch between the Helpdesk, Resident, and Technician sample views.

## Connect Supabase

1. Create a Supabase project and run [`supabase/schema.sql`](supabase/schema.sql) once in its SQL Editor.
2. Copy `.env.example` to `.env.local` and set the project URL and anon/publishable key:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

3. Add the same two public variables to the Vercel project and redeploy. The app uses Supabase Auth, Postgres with Row Level Security, the private `fixdorm-media` Storage bucket, and Realtime updates.
4. Residents can register from the sign-in screen. After a staff member registers, promote the profile using the provisioning SQL comments at the bottom of `supabase/schema.sql`. For a technician, also create their `technicians` row and add one or more skill rows.

The SQL creates a private media bucket (8 MB image limit), report status history, notifications, job assignments, reviews, and role-based policies. Do not put a service-role key in a `NEXT_PUBLIC_` variable.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. To check a production build locally, run `npm run build`.

## Roles and workflow

- **Resident:** creates a report, adds a photo and location, follows status updates, and reviews a completed repair.
- **Helpdesk:** verifies reports, sets priority, assigns a technician whose skills match the category, and updates report status.
- **Technician:** sees offers assigned to their account, accepts or declines, updates the repair status, and can attach a completion photo.

Available statuses are: Menunggu verifikasi, Menunggu teknisi, Menunggu konfirmasi teknisi, Teknisi menerima pekerjaan, Sedang diperbaiki, Menunggu suku cadang, and Selesai.

