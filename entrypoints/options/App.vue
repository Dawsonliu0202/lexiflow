<template>
  <div class="min-h-screen bg-[#f7f7f5] text-[#1c1c1a] font-sans antialiased py-8 px-4">
    <div class="mx-auto max-w-2xl space-y-6">
      <!-- Title Header -->
      <div class="flex items-center gap-3">
        <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-[#3b4cca] text-white font-bold text-base shadow-sm">
          L
        </div>
        <div>
          <h1 class="text-xl font-bold tracking-tight text-[#1c1c1a]">LexiFlow AI 设置</h1>
          <p class="text-xs text-[#5f5f5a]">个人划词翻译与生词本配置 · 本地优先 · 凭证安全隔离</p>
        </div>
      </div>

      <!-- AI Configuration Section -->
      <AiSection />

      <!-- Notion Sync Section -->
      <NotionSection />

      <!-- Local Backup & Export Section -->
      <BackupSection />

      <footer class="pt-4 text-center text-xs text-[#97978f]">
        LexiFlow AI v1.0.0 · 个人自用版 · 数据存储于本机 IndexedDB 与个人 Notion
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import AiSection from './sections/AiSection.vue';
import NotionSection from './sections/NotionSection.vue';
import BackupSection from './sections/BackupSection.vue';
</script>
