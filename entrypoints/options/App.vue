<template>
  <div class="min-h-screen bg-[#f7f7f5] text-[#1c1c1a] font-sans antialiased py-10 px-4 sm:px-6">
    <div class="mx-auto max-w-3xl space-y-6">
      <!-- Title Header -->
      <div class="flex items-center gap-3.5 border-b border-[#e8e8e4] pb-6">
        <img
          src="/icon/48.png"
          alt="LexiFlow AI Logo"
          class="h-11 w-11 rounded-2xl shadow-sm ring-1 ring-black/5"
        />
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-xl font-bold tracking-tight text-[#1c1c1a]">LexiFlow AI 设置</h1>
            <span class="rounded-full bg-[#eef0fb] px-2 py-0.5 text-[11px] font-semibold text-[#3b4cca]">v1.0.0</span>
          </div>
          <p class="text-xs text-[#5f5f5a] mt-0.5">个人划词翻译与生词本配置 · 本地优先 · 凭证安全隔离</p>
        </div>
      </div>

      <!-- AI Configuration Section -->
      <AiSection />

      <!-- Notion Sync Section -->
      <NotionSection />

      <!-- Local Backup & Export Section -->
      <BackupSection />

      <footer class="pt-4 text-center text-xs text-[#97978f]">
        LexiFlow AI · 个人自用语境生词本 · 数据存储于本机 IndexedDB 与个人 Notion
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import AiSection from './sections/AiSection.vue';
import NotionSection from './sections/NotionSection.vue';
import BackupSection from './sections/BackupSection.vue';
</script>
