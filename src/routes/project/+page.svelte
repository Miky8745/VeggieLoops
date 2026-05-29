<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { getCurrentWindow } from '@tauri-apps/api/window';

  const projectName = $page.url.searchParams.get('name') ?? 'Project';

  onMount(async () => {
    await getCurrentWindow().setTitle(projectName);
  });
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet" />
</svelte:head>

<div class="workspace">
  <aside class="sidebar">
    <div class="sidebar-top">
      <svg width="20" height="20" viewBox="0 0 30 30" fill="none" aria-hidden="true">
        <path d="M15 3C15 3 5 9.5 5 19C5 24.523 9.2 26.5 15 26.5C20.8 26.5 25 24.523 25 19C25 9.5 15 3 15 3Z" fill="#5BAD5B"/>
        <line x1="15" y1="26.5" x2="15" y2="13" stroke="#2E7D32" stroke-width="1.6" stroke-linecap="round"/>
        <line x1="15" y1="20" x2="19.5" y2="15.5" stroke="#2E7D32" stroke-width="1.6" stroke-linecap="round"/>
        <line x1="15" y1="16.5" x2="10.5" y2="13" stroke="#2E7D32" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
    </div>
  </aside>

  <div class="main">
    <div class="project-header">
      <h1 class="project-title">{projectName}</h1>
    </div>
    <div class="placeholder">
      <svg width="56" height="56" viewBox="0 0 56 56" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.2" aria-hidden="true">
        <rect x="4" y="4" width="48" height="48" rx="12"/>
        <path d="M20 28h16M28 20v16"/>
      </svg>
      <p class="placeholder-label">Workspace ready</p>
      <p class="placeholder-sub">Start building your veggie loop.</p>
    </div>
  </div>
</div>

<style>
  :global(html, body) { height: 100%; overflow: hidden; }
  :global(#svelte) { height: 100%; }

  .workspace {
    display: flex;
    height: 100vh;
    font-family: 'DM Sans', 'Segoe UI', system-ui, sans-serif;
    font-size: 14px;
    -webkit-font-smoothing: antialiased;

    --sidebar-bg: #1B2E1B;
    --sidebar-border: #233323;
    --main-bg: #F5F8F5;
    --text-muted: #6A8A6A;
    --main-text: #182E18;
    --main-border: #D6E8D6;
  }

  @media (prefers-color-scheme: dark) {
    .workspace {
      --sidebar-bg: #152415;
      --sidebar-border: #1C301C;
      --main-bg: #182818;
      --text-muted: #5A7A5A;
      --main-text: #C4DCC4;
      --main-border: #274027;
    }
  }

  .sidebar {
    width: 48px;
    background: var(--sidebar-bg);
    border-right: 1px solid var(--sidebar-border);
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .sidebar-top {
    padding: 14px 0;
  }

  .main {
    flex: 1;
    background: var(--main-bg);
    display: flex;
    flex-direction: column;
  }

  .project-header {
    padding: 14px 20px;
    border-bottom: 1px solid var(--main-border);
  }

  .project-title {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 17px;
    font-weight: 600;
    color: var(--main-text);
  }

  .placeholder {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: var(--text-muted);
    text-align: center;
  }

  .placeholder-label {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 15px;
    font-weight: 600;
    color: var(--main-text);
    opacity: 0.4;
  }

  .placeholder-sub {
    font-size: 13px;
    color: var(--text-muted);
  }
</style>
