import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import {
  BookOpen, Zap, MessageSquare, Quote, Lightbulb, Link, FileText,
  Check, Copy, RefreshCw, Layers, Inbox, Settings, Play, Rss,
  UserPlus, AlertCircle, AlertTriangle, Trash2, Edit2, Plus, X, Upload, Download, MoreHorizontal,
  Info, HelpCircle, ExternalLink, Filter, CheckSquare, Square, Search, Sparkles, ChevronRight, ChevronDown, ChevronUp, ArrowRight, AlignLeft, HelpCircle as QuestionIcon, ArrowLeft, Network, Share2, ZoomIn, ZoomOut, Maximize, StickyNote, Tag, AlignJustify
} from 'lucide-react';

// --- 数据模型 ---

// CORS 代理地址（用于解决跨域问题）
// 本地代理优先，外部代理备用
const CORS_PROXIES = [
  (url) => `/api/proxy?url=${encodeURIComponent(url)}`,  // 本地 Vite 代理（最可靠）
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`, // 新增 CodeTabs
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url) => `https://thingproxy.freeboard.io/fetch/${url}`, // ThingProxy 通常直接通过 path 传递
  (url) => `https://cors-anywhere.herokuapp.com/${url}`   // CORS Anywhere 也是直接拼接
];

// CORS代理管理器（避免全局变量冲突）
const proxyManager = {
  currentIndex: 0,
  proxies: [...CORS_PROXIES],
  failureCounts: new Array(CORS_PROXIES.length).fill(0),
  successCounts: new Array(CORS_PROXIES.length).fill(0),
  responseTimes: new Array(CORS_PROXIES.length).fill([]),
  lastUsed: new Array(CORS_PROXIES.length).fill(null),

  // 获取当前代理
  getCurrentProxy() {
    return this.proxies[this.currentIndex];
  },

  // 获取当前代理索引
  getCurrentIndex() {
    return this.currentIndex;
  },

  // 切换到下一个代理
  switchToNextProxy() {
    this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
    console.log('代理切换:', {
      from: this.proxies[(this.currentIndex - 1 + this.proxies.length) % this.proxies.length],
      to: this.proxies[this.currentIndex],
      index: this.currentIndex,
      total: this.proxies.length
    });
    return this.getCurrentProxy();
  },

  // 记录代理成功
  recordSuccess(responseTime = null) {
    this.successCounts[this.currentIndex]++;
    this.lastUsed[this.currentIndex] = Date.now();

    if (responseTime !== null) {
      this.responseTimes[this.currentIndex] = [
        ...this.responseTimes[this.currentIndex],
        responseTime
      ].slice(-10); // 保留最近10次响应时间
    }

    console.log('代理使用成功:', {
      proxy: this.proxies[this.currentIndex],
      successCount: this.successCounts[this.currentIndex],
      failureCount: this.failureCounts[this.currentIndex],
      avgResponseTime: this.getAverageResponseTime(this.currentIndex),
      errorRate: this.getErrorRate(this.currentIndex)
    });
  },

  // 记录代理失败
  recordFailure(responseTime = null) {
    this.failureCounts[this.currentIndex]++;
    this.lastUsed[this.currentIndex] = Date.now();

    if (responseTime !== null) {
      this.responseTimes[this.currentIndex] = [
        ...this.responseTimes[this.currentIndex],
        responseTime
      ].slice(-10); // 保留最近10次响应时间
    }

    console.log('代理使用失败:', {
      proxy: this.proxies[this.currentIndex],
      successCount: this.successCounts[this.currentIndex],
      failureCount: this.failureCounts[this.currentIndex],
      avgResponseTime: this.getAverageResponseTime(this.currentIndex),
      errorRate: this.getErrorRate(this.currentIndex)
    });
  },

  // 重置代理索引
  reset() {
    console.log('代理管理器重置');
    this.currentIndex = 0;
    this.failureCounts = new Array(this.proxies.length).fill(0);
    this.successCounts = new Array(this.proxies.length).fill(0);
    this.responseTimes = new Array(this.proxies.length).fill([]);
  },

  // 获取所有代理
  getAllProxies() {
    return [...this.proxies];
  },

  // 计算平均响应时间
  getAverageResponseTime(index) {
    const times = this.responseTimes[index];
    if (times.length === 0) return 0;
    return Math.round(times.reduce((sum, time) => sum + time, 0) / times.length);
  },

  // 计算错误率
  getErrorRate(index) {
    const totalAttempts = this.successCounts[index] + this.failureCounts[index];
    if (totalAttempts === 0) return 0;
    return (this.failureCounts[index] / totalAttempts).toFixed(2);
  },

  // 检查代理健康状态
  isProxyHealthy(index) {
    const errorRate = this.getErrorRate(index);
    const totalAttempts = this.successCounts[index] + this.failureCounts[index];
    return totalAttempts < 5 || parseFloat(errorRate) < 0.5;
  },

  // 获取代理状态
  getProxyStatus() {
    return this.proxies.map((proxy, index) => ({
      proxy,
      index,
      isCurrent: index === this.currentIndex,
      successCount: this.successCounts[index],
      failureCount: this.failureCounts[index],
      avgResponseTime: this.getAverageResponseTime(index),
      errorRate: this.getErrorRate(index),
      isHealthy: this.isProxyHealthy(index),
      lastUsed: this.lastUsed[index]
    }));
  },

  // 根据成功率和响应时间选择最佳代理
  selectBestProxy() {
    let bestIndex = 0;
    let bestScore = -1;

    this.proxies.forEach((proxy, index) => {
      const totalAttempts = this.successCounts[index] + this.failureCounts[index];
      const successRate = totalAttempts > 0 ? this.successCounts[index] / totalAttempts : 0;
      const avgResponseTime = this.getAverageResponseTime(index);

      // 综合评分：成功率 * 0.7 + (1 / (1 + avgResponseTime/1000)) * 0.3
      // 成功率占70%，响应时间占30%
      const responseTimeFactor = avgResponseTime > 0 ? 1 / (1 + avgResponseTime / 1000) : 1;
      const score = successRate * 0.7 + responseTimeFactor * 0.3;

      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    this.currentIndex = bestIndex;
    console.log('选择最佳代理:', {
      proxy: this.proxies[bestIndex],
      score: bestScore,
      successRate: this.successCounts[bestIndex] / (this.successCounts[bestIndex] + this.failureCounts[bestIndex] || 1),
      avgResponseTime: this.getAverageResponseTime(bestIndex)
    });
    return this.getCurrentProxy();
  }
};

// 导出代理管理器方法（保持向后兼容并添加新功能）
const getCorsProxy = () => proxyManager.getCurrentProxy();
const switchToNextProxy = () => proxyManager.switchToNextProxy();
const resetProxy = () => proxyManager.reset();
const getAllProxies = () => proxyManager.getAllProxies();
const recordProxySuccess = (responseTime) => proxyManager.recordSuccess(responseTime);
const recordProxyFailure = (responseTime) => proxyManager.recordFailure(responseTime);
const getProxyStatus = () => proxyManager.getProxyStatus();
const selectBestProxy = () => proxyManager.selectBestProxy();
const getCurrentProxyIndex = () => proxyManager.getCurrentIndex();

// 请求队列管理器（控制并发请求）
const requestQueue = {
  maxConcurrent: 3,  // 最大并发请求数
  running: 0,        // 当前运行的请求数
  queue: [],         // 等待队列

  // 添加请求到队列
  add(fn, priority = 0) {
    return new Promise((resolve, reject) => {
      const task = { fn, resolve, reject, priority };

      // 根据优先级插入队列（优先级高的先执行）
      let inserted = false;
      for (let i = 0; i < this.queue.length; i++) {
        if (task.priority > this.queue[i].priority) {
          this.queue.splice(i, 0, task);
          inserted = true;
          break;
        }
      }
      if (!inserted) {
        this.queue.push(task);
      }

      this.processNext();
    });
  },

  // 处理下一个请求
  processNext() {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const task = this.queue.shift();
    this.running++;

    Promise.resolve()
      .then(() => task.fn())
      .then(result => task.resolve(result))
      .catch(error => task.reject(error))
      .finally(() => {
        this.running--;
        this.processNext();
      });
  },

  // 获取队列状态
  getStatus() {
    return {
      running: this.running,
      queued: this.queue.length,
      maxConcurrent: this.maxConcurrent
    };
  },

  // 清空队列
  clear() {
    this.queue = [];
  }
};

// 真实可用的 RSS 订阅源
const INITIAL_SUBSCRIPTIONS = [
  {
    id: 1,
    name: "阮一峰的网络日志",
    rssUrl: "https://www.ruanyifeng.com/blog/atom.xml",
    status: "active",
    frequency: "每周更新",
    last_fetch: "点击刷新获取",
    article_count: 0,
    category: "技术博客"
  },
  {
    id: 2,
    name: "少数派",
    rssUrl: "https://sspai.com/feed",
    status: "active",
    frequency: "每日更新",
    last_fetch: "点击刷新获取",
    article_count: 0,
    category: "数字生活"
  },
  {
    id: 3,
    name: "36氪",
    rssUrl: "https://36kr.com/feed",
    status: "active",
    frequency: "实时更新",
    last_fetch: "点击刷新获取",
    article_count: 0,
    category: "科技商业"
  },
  {
    id: 4,
    name: "虎嗅网",
    rssUrl: "https://rss.huxiu.com/",
    status: "active",
    frequency: "实时更新",
    last_fetch: "点击刷新获取",
    article_count: 0,
    category: "商业科技"
  },
  {
    id: 5,
    name: "小众软件",
    rssUrl: "https://feeds.appinn.com/appinns/",
    status: "active",
    frequency: "每日更新",
    last_fetch: "点击刷新获取",
    article_count: 0,
    category: "软件推荐"
  }
];

// --- RSS 解析工具函数 ---

/**
 * 通过 CORS 代理获取并解析 RSS 源
 * @param rssUrl RSS 源地址
 * @returns 解析后的文章列表
 */
const fetchRSSFeed = async (rssUrl, retryCount = 0) => {
  const maxRetries = getAllProxies().length;

  // 将请求添加到队列（优先级：1，普通请求）
  return requestQueue.add(async () => {
    const startTime = Date.now(); // 记录开始时间，移到try块之前
    try {
      // 获取当前代理函数并调用
      const proxyFn = getCorsProxy();
      // 兼容旧代码：如果 proxyFn 是字符串（虽然我们改了，但为了保险），回退到旧逻辑，否则调用函数
      const proxyUrl = typeof proxyFn === 'function' ? proxyFn(rssUrl) : proxyFn + encodeURIComponent(rssUrl);

      console.log('尝试获取 RSS:', rssUrl, '使用代理:', typeof proxyFn === 'function' ? 'Custom Function' : proxyFn);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时（增加以提高可靠性）

      const response = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime; // 计算响应时间

      if (!response.ok) {
        recordProxyFailure(responseTime);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const text = await response.text();
      const parser = new DOMParser();
      const xml = parser.parseFromString(text, 'text/xml');

      // 检查解析错误
      const parseError = xml.querySelector('parsererror');
      if (parseError) {
        recordProxyFailure(responseTime);
        throw new Error('XML 解析错误');
      }

      // 记录代理成功
      recordProxySuccess(responseTime);

      const articles = [];

      // 尝试解析 RSS 2.0 格式
      const rssItems = xml.querySelectorAll('item');
      if (rssItems.length > 0) {
        rssItems.forEach((item, index) => {
          if (index >= 5) return; // 只取前5篇
          articles.push({
            title: item.querySelector('title')?.textContent || '无标题',
            link: item.querySelector('link')?.textContent || '#',
            description: item.querySelector('description')?.textContent?.replace(/<[^>]*>/g, '').substring(0, 200) || '暂无摘要',
            pubDate: item.querySelector('pubDate')?.textContent || new Date().toISOString()
          });
        });
        return articles;
      }

      // 尝试解析 Atom 格式
      const atomEntries = xml.querySelectorAll('entry');
      if (atomEntries.length > 0) {
        atomEntries.forEach((entry, index) => {
          if (index >= 5) return; // 只取前5篇
          const linkEl = entry.querySelector('link[href]');
          articles.push({
            title: entry.querySelector('title')?.textContent || '无标题',
            link: linkEl?.getAttribute('href') || '#',
            description: (entry.querySelector('summary')?.textContent || entry.querySelector('content')?.textContent || '').replace(/<[^>]*>/g, '').substring(0, 200) || '暂无摘要',
            pubDate: entry.querySelector('published')?.textContent || entry.querySelector('updated')?.textContent || new Date().toISOString()
          });
        });
        return articles;
      }

      return [];
    } catch (error) {
      const responseTime = Date.now() - startTime; // 计算响应时间
      console.error('获取 RSS 失败:', error.message, '响应时间:', responseTime, 'ms');
      recordProxyFailure(responseTime);

      // 如果还有重试次数，切换代理并重试，使用指数退避策略
      if (retryCount < maxRetries - 1) {
        switchToNextProxy();
        // 指数退避：基础延迟 * 2^重试次数，加上随机抖动避免同时重试
        const baseDelay = 1000;
        const delay = Math.min(baseDelay * Math.pow(2, retryCount) + Math.random() * 1000, 10000);
        console.log(`重试 (${retryCount + 1}/${maxRetries - 1})... 等待 ${delay}ms`);
        // 等待延迟
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchRSSFeed(rssUrl, retryCount + 1);
      }

      throw error;
    }
  }, 1); // 优先级1：普通请求
};

/**
 * 格式化时间为相对时间
 * @param dateString 日期字符串
 * @returns 相对时间描述
 */
const formatRelativeTime = (dateString) => {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins} 分钟前`;
    if (diffHours < 24) return `${diffHours} 小时前`;
    if (diffDays < 7) return `${diffDays} 天前`;
    return date.toLocaleDateString('zh-CN');
  } catch {
    return '未知时间';
  }
};

// --- AI 分析工具函数 ---

/**
 * 获取网页文章的文本内容
 * @param url 文章 URL
 * @param retryCount 当前重试次数
 * @returns 文章文本内容
 */
const fetchArticleContent = async (url, retryCount = 0) => {
  const maxRetries = getAllProxies().length;

  // 将请求添加到队列（优先级：2，文章内容获取优先级高于普通RSS请求）
  return requestQueue.add(async () => {
    try {
      // 获取当前代理函数并调用
      const proxyFn = getCorsProxy();
      const proxyUrl = typeof proxyFn === 'function' ? proxyFn(url) : proxyFn + encodeURIComponent(url);

      console.log('尝试获取文章内容:', url, '使用代理:', typeof proxyFn === 'function' ? 'Custom Function' : proxyFn);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000); // 25秒超时（增加以提高可靠性）

      const response = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`获取文章失败: ${response.status}`);
      }

      const html = await response.text();

      // 创建 DOM 解析器提取文本内容
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // 移除脚本、样式等无关元素
      const elementsToRemove = doc.querySelectorAll('script, style, nav, header, footer, aside, .ad, .advertisement');
      elementsToRemove.forEach(el => el.remove());

      // 优先提取文章主体内容
      const articleEl = doc.querySelector('article, .article, .post, .content, .main-content, #content, main');
      const textContent = articleEl
        ? articleEl.textContent
        : doc.body?.textContent || '';

      // 清理文本：去除多余空白
      return textContent
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 8000); // 限制长度避免超出 API 限制
    } catch (error) {
      console.error('获取文章内容失败:', error);

      // 如果还有重试次数，切换代理并重试，使用指数退避策略
      if (retryCount < maxRetries - 1) {
        switchToNextProxy();
        // 指数退避：基础延迟 * 2^重试次数，加上随机抖动避免同时重试
        const baseDelay = 800;
        const delay = Math.min(baseDelay * Math.pow(2, retryCount) + Math.random() * 1000, 10000);
        console.log(`文章获取重试 (${retryCount + 1}/${maxRetries - 1})... 等待 ${delay}ms`);
        // 等待延迟
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchArticleContent(url, retryCount + 1);
      }

      throw error;
    }
  }, 2); // 优先级2：文章内容获取
};

/**
 * 使用讯飞星火 AI 分析文章
 * @param content 文章内容
 * @param apiKey 讯飞 API Key (格式: APIKey:APISecret)
 * @returns 分析结果
 */
const analyzeWithSparkAI = async (content, apiKey, retryCount = 0) => {
  const prompt = `你是一个专业的文章分析助手。请深度分析以下文章内容，提取核心信息。

【重要格式要求】
1. 核心观点：提取 3-5 个核心观点
   - 每个观点用一句完整的陈述句表达
   - 绝对不要使用问号
   - 绝对不要使用"什么"、"吗"、"呢"、"为何"、"如何"等疑问词
   - 直接陈述作者的观点或文章的结论
   
2. 金句摘录：提取 2-3 句最精彩的原文句子
   - 选择最有洞察力、最能代表文章精华的句子
   - 保持原文不做修改
   
3. 关键概念：提取 2-4 个关键概念
   - 每个概念包含名称和简要定义
   - 定义要简洁明了，一两句话即可

请严格按照以下 JSON 格式返回，不要包含任何其他文字：
{
  "viewpoints": ["观点1", "观点2", "观点3"],
  "quotes": ["金句1", "金句2"],
  "concepts": [
    {"term": "概念名称", "definition": "概念定义"},
    {"term": "概念名称2", "definition": "概念定义2"}
  ]
}

【文章内容】
${content}`;

  // 将 AI 分析请求添加到队列（优先级：3，AI 分析优先级最高）
  return requestQueue.add(async () => {
    try {
      const response = await fetch(
        'https://api.siliconflow.cn/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'Qwen/Qwen2.5-7B-Instruct',
            messages: [
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0.7,
            max_tokens: 2048,
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error?.message || `API 错误: ${response.status}`);
      }

      const data = await response.json();
      const textContent = data.choices?.[0]?.message?.content;

      if (!textContent) {
        throw new Error('AI 未返回有效内容');
      }

      // 解析 JSON 响应（处理可能的 markdown 代码块包装）
      let jsonStr = textContent;
      const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }

      const result = JSON.parse(jsonStr.trim());

      return {
        viewpoints: result.viewpoints || [],
        quotes: result.quotes || [],
        concepts: result.concepts || []
      };
    } catch (error) {
      console.error('AI 分析失败:', error);

      // AI API 请求失败时的重试逻辑（最多重试3次）
      const maxRetries = 3;
      if (retryCount < maxRetries) {
        // 指数退避：基础延迟 * 2^重试次数，加上随机抖动
        const baseDelay = 1500;
        const delay = Math.min(baseDelay * Math.pow(2, retryCount) + Math.random() * 1000, 10000);
        console.log(`AI 分析重试 (${retryCount + 1}/${maxRetries})... 等待 ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return analyzeWithSparkAI(content, apiKey, retryCount + 1);
      }

      throw error;
    }
  }, 3); // 优先级3：AI 分析请求优先级最高
};

// 模拟收件箱初始数据
const INITIAL_INBOX = [
  {
    id: 101,
    title: "为什么聪明人总是在做蠢事？",
    source: "L先生说",
    date: "10 分钟前",
    status: "pending",
    url: "https://www.scientificamerican.com/article/rational-and-irrational-thought-the-thinking-that-iq-tests-miss/",
    summary: "高智商并不等同于理性。大脑是认知吝啬鬼，倾向于使用直觉而非消耗能量的逻辑思考。",
    quote: "智力是引擎，理性是方向盘。引擎越强，方向盘失灵时车祸越惨烈。"
  },
  {
    id: 102,
    title: "如何不靠运气致富：纳瓦尔的财富杠杆",
    source: "刘润",
    date: "2 小时前",
    status: "pending",
    url: "https://nav.al/rich",
    summary: "在AI和数字化时代，传统的劳动力杠杆正在失效。普通人需要寻找新的\"零边际成本\"杠杆。",
    quote: "在这个时代，复制的成本趋近于零，独特的判断力成为了最稀缺的资产。"
  },
  {
    id: 103,
    title: "AI 时代的超级个体生存指南",
    source: "歸藏的 AI 工具箱",
    date: "昨天",
    status: "analyzed",
    url: "https://openai.com/blog",
    summary: "工具的进化速度超过了人类的学习速度。成为超级个体的关键不是掌握所有工具，而是建立核心工作流。",
    quote: "不要做工具的奴隶，要做驾驭工具的牧羊人。"
  },
];

// 模拟多篇文章的详细解析数据
const MOCK_RESULTS_DB = {
  101: {
    title: "为什么聪明人总是在做蠢事？",
    author: "L先生说",
    url: "https://www.scientificamerican.com/article/rational-and-irrational-thought-the-thinking-that-iq-tests-miss/",
    summary: "文章探讨了\"高智商\"与\"理性决策\"之间的脱节。核心逻辑在于：大脑是一个巨大的认知吝啬鬼，倾向于使用直觉（系统1）而非耗能的逻辑（系统2）。聪明人往往因为过度自信（智力傲慢）而跳过验证步骤，导致\"理性障碍\"。",
    core_question: "为什么拥有高智商的人，在做决策时依然会犯低级错误？",
    viewpoints: [
      "智商（IQ）只衡量了大脑的处理速度，没有衡量大脑的\"反省心智\"（Reflective Mind）。",
      "聪明人更容易陷入\"动机性推理\"——利用高智商为自己错误的直觉寻找合理的借口。",
      "避免愚蠢的关键不在于增加知识，而在于建立\"认知防火墙\"：强制性的检查清单和事前验尸（Pre-mortem）。"
    ],
    quotes: [
      "智力是引擎，理性是方向盘。引擎越强，方向盘失灵时车祸越惨烈。",
      "承认自己可能是错的，是智慧的最高形式。"
    ],
    concepts: [
      { term: "理性障碍", definition: "指拥有足够智力的人，在思考和行动时却无法理性行事的现象。" },
      { term: "认知吝啬鬼", definition: "大脑的一种默认机制，为了节省能量，倾向于通过简单的线索做判断。" }
    ],
    related_articles: [
      { id: 201, title: "思考，快与慢：大脑的双系统模型", source: "L先生说", date: "3天前", status: "pending", url: "#", summary: "丹尼尔·卡尼曼的经典理论：系统1负责直觉，系统2负责逻辑。", quote: "直觉是捷径，也是陷阱。" },
      { id: 202, title: "反直觉思考：为什么我们总是做错决定？", source: "万维钢", date: "1周前", status: "analyzed", url: "#", summary: "常识往往是不可靠的。科学思维的核心就是敢于质疑直觉。", quote: "所谓科学精神，就是一种反直觉的勇气。" }
    ]
  },
  102: {
    title: "如何不靠运气致富：纳瓦尔的财富杠杆",
    author: "刘润",
    url: "https://nav.al/rich",
    summary: "本文深度解析了硅谷投资人纳瓦尔的财富观。核心观点在于：财富不是零和博弈，而是正和游戏。通过产品化你自己，利用代码和媒体这两种\"边际成本为零\"的新型杠杆，任何人都能在没有资本原始积累的情况下，通过独特的专长实现财富自由。",
    core_question: "普通人如何获得巨大的财富杠杆？",
    viewpoints: [
      "财富不是零和博弈，而是正和游戏。",
      "最强的新杠杆是\"代码\"和\"媒体\"，复制边际成本几乎为零。",
      "要致富，必须将收入与时间解绑，拥有权益（Equity）或资产。"
    ],
    quotes: [
      "把自己产品化。 (Productize Yourself.)",
      "依靠运气致富，那是赌博；依靠判断力致富，那是必然。"
    ],
    concepts: [
      { term: "零边际成本杠杆", definition: "指代码和媒体。创造后复制成本极低，可无限分发。" },
      { term: "专长", definition: "无法通过培训获得，源于好奇心和个人独特经历的知识。" }
    ],
    related_articles: [
      { id: 203, title: "纳瓦尔宝典解读：幸福也是一种技能", source: "刘润", date: "1个月前", status: "analyzed", url: "#", summary: "纳瓦尔不仅谈财富，更谈幸福。", quote: "欲望就是你跟自己签的合同。" }
    ]
  },
  default: {
    title: "AI 时代的超级个体生存指南",
    author: "Skill AI",
    url: "https://openai.com/blog",
    summary: "工具的进化速度超过了人类的学习速度。成为超级个体的关键不是掌握所有工具，而是建立核心工作流，让AI成为你的外脑。",
    core_question: "AI 时代，人类的核心竞争力是什么？",
    viewpoints: [
      "核心竞争力是提出正确问题的能力（Prompt Engineering）和整合能力。",
      "不要做工具的奴隶，要做驾驭工具的牧羊人。",
      "建立个人的数字化工作流（Workflow）比掌握单一工具更重要。"
    ],
    quotes: [
      "不要做工具的奴隶，要做驾驭工具的牧羊人。",
      "未来的差距不在于谁拥有AI，而在于谁能更好地与AI协作。"
    ],
    concepts: [
      { term: "超级个体", definition: "指利用 AI 和数字化工具，以一人之力创造出传统团队产出的高效能个人。" }
    ],
    related_articles: []
  }
};

// 初始知识图谱节点
const INITIAL_GRAPH_NODES = [
  { id: 'b1', type: 'book', label: '纳瓦尔宝典', color: '#F59E0B', x: 400, y: 300, desc: "关于财富与幸福的硅谷智慧。" },
  { id: 'b2', type: 'book', label: '认知觉醒', color: '#10B981', x: 250, y: 150, desc: "开启自我改变的原动力，脑科学视角的成长指南。" },
  { id: 'b3', type: 'book', label: '批判性思维', color: '#3B82F6', x: 550, y: 150, desc: "带你走出思维误区，建立清晰的逻辑系统。" },
  { id: 'b4', type: 'book', label: '新穷人', color: '#EF4444', x: 400, y: 450, desc: "工作、消费主义与新穷人，社会学视角的洞察。" },
  { id: 'c1', type: 'concept', label: '杠杆', x: 520, y: 350, parent: 'b1', desc: "复制边际成本为零的工具，如代码和媒体。" },
  { id: 'c2', type: 'concept', label: '复利', x: 320, y: 380, parent: 'b1', desc: "长期坚持带来的指数级回报，适用于财富、知识和关系。" },
  { id: 'c3', type: 'concept', label: '元认知', x: 150, y: 100, parent: 'b2', desc: "对思考的思考，人类的终极能力。" },
  { id: 'c4', type: 'concept', label: '潜意识', x: 180, y: 250, parent: 'b2', desc: "生命留给我们的彩蛋，通过模糊的直觉指引方向。" },
  { id: 'c5', type: 'concept', label: '稻草人谬误', x: 650, y: 80, parent: 'b3', desc: "歪曲对方的观点，攻击一个不存在的靶子。" },
  { id: 'c6', type: 'concept', label: '演绎推理', x: 700, y: 200, parent: 'b3', desc: "从一般到特殊的逻辑推演过程。" },
  { id: 'c7', type: 'concept', label: '消费美学', x: 300, y: 550, parent: 'b4', desc: "从工作伦理转向消费美学，社会评价体系的变迁。" },
  { id: 'c8', type: 'concept', label: '底层阶级', x: 500, y: 550, parent: 'b4', desc: "在消费社会中，无法正常消费的人群被定义为新穷人。" },
];

// 初始连线
const INITIAL_GRAPH_LINKS = [
  { source: 'b1', target: 'c1' },
  { source: 'b1', target: 'c2' },
  { source: 'b2', target: 'c3' },
  { source: 'b2', target: 'c4' },
  { source: 'b3', target: 'c5' },
  { source: 'b3', target: 'c6' },
  { source: 'b4', target: 'c7' },
  { source: 'b4', target: 'c8' },
  { source: 'c3', target: 'c6', dashed: true },
  { source: 'c1', target: 'c8', dashed: true },
];

/**
 * [NEW] 预览逻辑组件：负责通过代理获取 HTML
 * 能够绕过 X-Frame-Options 限制
 */
const PreviewLogic = ({ url, onHtmlLoaded, setLoading }) => {
  useEffect(() => {
    if (!url) return;

    const fetchHtml = async () => {
      setLoading(true);
      try {
        console.log('正在预览获取 HTML:', url);
        // 复用 getCorsProxy 逻辑
        const proxyUrl = getCorsProxy() + encodeURIComponent(url);
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error('Fetch failed');

        const html = await response.text();

        // 简单处理：将相对路径转为绝对路径 (基础处理，不保证完美)
        // 提取 base URL
        const urlObj = new URL(url);
        const baseUrl = urlObj.origin;

        let processedHtml = html
          .replace(/src="\//g, `src="${baseUrl}/`)
          .replace(/href="\//g, `href="${baseUrl}/`)
          // 尝试移除 X-Frame-Options meta 标签 (虽然通常是在 header，但有时在 meta)
          .replace(/<meta[^>]*X-Frame-Options[^>]*>/gi, '');

        // 注入 padding 以适应全屏
        processedHtml = processedHtml + `<style>body { padding-top: 0px !important; margin: 0; }</style>`;

        setPreviewHtml(processedHtml);
      } catch (err) {
        console.error('预览获取失败，回退 iframe', err);
        // 失败时不通过 srcDoc，而是让 iframe 尝试直接加载 (虽然可能被挡)
        onHtmlLoaded(null);
      } finally {
        setLoading(false);
      }
    };

    fetchHtml();
  }, [url]);

  return null;
};

const PreviewLogicV2 = ({ url, onHtmlLoaded, setLoading }) => {
  useEffect(() => {
    if (!url) return;

    const fetchHtml = async () => {
      setLoading(true);

      // 多代理备选方案（按照可靠性排序）
      const proxyServices = [
        {
          name: 'AllOrigins',
          getUrl: (targetUrl) => `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`,
          parseResponse: async (res) => {
            const data = await res.json();
            return data.contents;
          }
        },
        {
          name: 'corsproxy.io',
          getUrl: (targetUrl) => `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
          parseResponse: async (res) => await res.text()
        },
        {
          name: 'cors-anywhere (herokuapp)',
          getUrl: (targetUrl) => `https://cors-anywhere.herokuapp.com/${targetUrl}`,
          parseResponse: async (res) => await res.text()
        }
      ];

      let html = null;
      let lastError = null;

      // 依次尝试每个代理服务
      for (const proxy of proxyServices) {
        try {
          console.log(`尝试使用 ${proxy.name} 代理获取:`, url);

          const proxyUrl = proxy.getUrl(url);
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000);

          const response = await fetch(proxyUrl, {
            signal: controller.signal,
            headers: {
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
          });
          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          html = await proxy.parseResponse(response);

          if (html && html.length > 500) {
            console.log(`${proxy.name} 代理成功获取内容，长度: ${html.length}`);
            break;
          } else {
            throw new Error('内容太短或为空');
          }
        } catch (err) {
          console.warn(`${proxy.name} 代理失败:`, err.message);
          lastError = err;
        }
      }

      // 如果所有代理都失败
      if (!html) {
        console.error('所有代理都失败了:', lastError);
        onHtmlLoaded(null);
        setLoading(false);
        return;
      }

      try {
        const urlObj = new URL(url);
        const baseUrl = urlObj.origin;

        // 使用 DOMParser 解析 HTML 并提取文章内容
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // 移除不需要的元素（广告、导航、脚本等）
        const removeSelectors = [
          'script', 'style', 'nav', 'header', 'footer', 'aside',
          '.ad', '.ads', '.advertisement', '.sidebar', '.comment', '.comments',
          '.related', '.recommend', '.share', '.social', '[class*="ad-"]',
          '.navigation', '.nav', '.menu', '.popup', '.modal', '.overlay',
          'iframe', 'video', '.video-wrapper', '.banner', 'noscript'
        ];
        removeSelectors.forEach(selector => {
          doc.querySelectorAll(selector).forEach(el => el.remove());
        });

        // 尝试提取文章主体内容
        const articleSelectors = [
          'article', '.article', '.article-content', '.post-content',
          '.content', '.main-content', '#content', 'main',
          '.rich_media_content', '.js_content',
          '.entry-content', '.post-body', '.article-body',
          '#js_content', '.rich_media_wrp'
        ];

        let articleContent = null;
        for (const selector of articleSelectors) {
          const el = doc.querySelector(selector);
          if (el && el.textContent.trim().length > 200) {
            articleContent = el;
            break;
          }
        }

        // 如果没找到文章容器，使用 body
        if (!articleContent) {
          articleContent = doc.body;
        }

        // 处理图片路径（转为绝对路径）
        articleContent.querySelectorAll('img').forEach(img => {
          const src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-original');
          if (src) {
            let absoluteSrc = src;
            if (src.startsWith('//')) {
              absoluteSrc = 'https:' + src;
            } else if (src.startsWith('/')) {
              absoluteSrc = baseUrl + src;
            } else if (!src.startsWith('http') && !src.startsWith('data:')) {
              absoluteSrc = baseUrl + '/' + src;
            }
            img.setAttribute('src', absoluteSrc);
            img.removeAttribute('data-src');
            img.removeAttribute('data-original');
            img.removeAttribute('loading');
          }
        });

        // 处理链接路径
        articleContent.querySelectorAll('a').forEach(a => {
          const href = a.getAttribute('href');
          if (href) {
            if (href.startsWith('/')) {
              a.setAttribute('href', baseUrl + href);
            } else if (!href.startsWith('http') && !href.startsWith('#') && !href.startsWith('javascript:')) {
              a.setAttribute('href', baseUrl + '/' + href);
            }
          }
          a.setAttribute('target', '_blank');
          a.setAttribute('rel', 'noopener noreferrer');
        });

        // 返回提取的纯 HTML 内容（用于直接渲染到页面，不使用 iframe）
        onHtmlLoaded(articleContent.innerHTML);
      } catch (err) {
        console.error('HTML 解析错误:', err);
        onHtmlLoaded(null);
      } finally {
        setLoading(false);
      }
    };

    fetchHtml();
  }, [url]);

  return null;
};


const SkillAdminPanel = () => {
  const [currentView, setCurrentView] = useState('inbox');
  const [showOriginalUrl, setShowOriginalUrl] = useState(null); // [NEW] 文章预览弹窗状态
  const [previewHtml, setPreviewHtml] = useState(null); // [NEW] 预览文章的 HTML 内容 (用于绕过 iframe 限制)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false); // [NEW] 预览加载状态

  // 右键菜单相关状态
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, selectedText: '' });
  // 笔记弹窗状态
  const [noteModal, setNoteModal] = useState({ visible: false, excerpt: '', isExcerpt: false });
  // 阅读笔记内容（独立于智能笔记视图）
  const [readerNoteContent, setReaderNoteContent] = useState('');
  const [readerNoteTags, setReaderNoteTags] = useState('');

  // 从 localStorage 读取订阅数据，如果没有则使用默认值
  const [subscriptions, setSubscriptions] = useState(() => {
    const saved = localStorage.getItem('rss_subscriptions');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return INITIAL_SUBSCRIPTIONS;
      }
    }
    return INITIAL_SUBSCRIPTIONS;
  });

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // 从 localStorage 读取收件箱数据
  const [inboxItems, setInboxItems] = useState(() => {
    const saved = localStorage.getItem('rss_inbox');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return INITIAL_INBOX;
      }
    }
    return INITIAL_INBOX;
  });

  const [isInboxRefreshing, setIsInboxRefreshing] = useState(false);
  const [inboxFilter, setInboxFilter] = useState('all');
  const [selectedFeedId, setSelectedFeedId] = useState(null); // [NEW] 选中的订阅源 ID
  const [newSubName, setNewSubName] = useState('');
  const [newSubRss, setNewSubRss] = useState('');
  const [newSubCategory, setNewSubCategory] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all'); // [NEW] 分类筛选
  const [refreshingSubId, setRefreshingSubId] = useState(null); // [NEW] 正在刷新的订阅源 ID
  // 自定义确认模态框状态
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, subId: null, subName: '' });
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [currentRelatedArticles, setCurrentRelatedArticles] = useState([]);

  // Knowledge Graph State (Dynamic)
  const [graphNodes, setGraphNodes] = useState(INITIAL_GRAPH_NODES);
  const [graphLinks, setGraphLinks] = useState(INITIAL_GRAPH_LINKS);
  const [selectedNode, setSelectedNode] = useState(null);
  const [graphSearch, setGraphSearch] = useState('');

  // 添加节点模态框状态
  const [isAddNodeModalOpen, setIsAddNodeModalOpen] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState(null); // 用于标记当前是否在编辑模式及其ID
  const [newNodeLabel, setNewNodeLabel] = useState('');
  const [newNodeType, setNewNodeType] = useState('concept');
  const [newNodeCustomType, setNewNodeCustomType] = useState(''); // 自定义类型
  const [newNodeDesc, setNewNodeDesc] = useState('');
  const [newNodeParent, setNewNodeParent] = useState(''); // 关联的书籍/父节点
  const [newNodeColor, setNewNodeColor] = useState('#7CAE7A'); // 自定义颜色
  // 保存用户自定义的节点类型列表
  const [customNodeTypes, setCustomNodeTypes] = useState(() => {
    const saved = localStorage.getItem('custom_node_types');
    if (saved) {
      try { return JSON.parse(saved); } catch { return []; }
    }
    return [];
  });

  // AI 概念对话相关状态
  // const [nodeAiInsight, setNodeAiInsight] = useState(''); // REPLACED BY nodeInsights
  // const [isLoadingInsight, setIsLoadingInsight] = useState(false); // REPLACED BY insightLoadingNodeId
  const [nodeInsights, setNodeInsights] = useState({}); // 缓存所有节点的洞察 { [nodeId]: content }
  const [insightLoadingNodeId, setInsightLoadingNodeId] = useState(null); // 当前正在生成洞察的节点ID
  const [showNodeChatModal, setShowNodeChatModal] = useState(false); // 对话模态框
  const [nodeChatMessages, setNodeChatMessages] = useState([]); // 对话消息列表
  const [nodeChatInput, setNodeChatInput] = useState(''); // 用户输入
  const [isNodeChatLoading, setIsNodeChatLoading] = useState(false);

  // Reader Note Modal States
  const [readerNoteType, setReaderNoteType] = useState('note');
  const [readerNoteCustomType, setReaderNoteCustomType] = useState('');
  const [readerNoteName, setReaderNoteName] = useState('');
  const [readerNoteColor, setReaderNoteColor] = useState('#8B5CF6');

  // D3 References
  const svgRef = useRef(null);
  const simulationRef = useRef(null);
  const nodesRef = useRef(graphNodes.map(d => ({ ...d }))); // Working copy for d3
  const linksRef = useRef(graphLinks.map(d => ({ ...d }))); // Working copy for d3

  // Initialize Simulation
  useEffect(() => {
    if (currentView !== 'graph' || !svgRef.current) return;

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    // --- Sync State to D3 Refs ---
    // Merge graphNodes state into nodesRef to preserve simulation state (x, y, vx, vy)
    const oldNodesMap = new Map((nodesRef.current || []).map(n => [n.id, n]));
    const newNodes = graphNodes.map(n => {
      const oldNode = oldNodesMap.get(n.id);
      if (oldNode) return oldNode;
      return { ...n };
    });
    nodesRef.current = newNodes;
    linksRef.current = graphLinks.map(d => ({ ...d }));
    // -----------------------------

    // Simulation setup
    const simulation = d3.forceSimulation(nodesRef.current)
      .force("link", d3.forceLink(linksRef.current).id(d => d.id).distance(100).iterations(1))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("x", d3.forceX(width / 2).strength(0.05))
      .force("y", d3.forceY(height / 2).strength(0.05))
      .force("collide", d3.forceCollide().radius(40))
      .velocityDecay(0.6) // 增加阻尼防止飞散
      .alphaTarget(0.01) // 保持极微小的呼吸感
      .on("tick", ticked);

    simulationRef.current = simulation;

    function ticked() {
      const svg = d3.select(svgRef.current);

      // Update links
      svg.selectAll("line.link-line")
        .data(linksRef.current)
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

      // Update nodes
      svg.selectAll("g.node-group")
        .data(nodesRef.current)
        .attr("transform", d => `translate(${d.x},${d.y})`);
    }

    // Drag behavior
    const drag = d3.drag()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    d3.select(svgRef.current).selectAll("g.node-group").call(drag);

    return () => {
      simulation.stop();
    };
  }, [currentView, graphNodes, graphLinks]); // Re-run if data changes (simplified)

  // Sync state changes to refs (Simple restart approach)
  useEffect(() => {
    nodesRef.current = graphNodes.map(d => ({ ...d }));
    linksRef.current = graphLinks.map(d => ({ ...d }));
  }, [graphNodes, graphLinks]);


  // Smart Notes State
  const [noteContent, setNoteContent] = useState('');
  const [noteTags, setNoteTags] = useState('');
  const [isNoteSaving, setIsNoteSaving] = useState(false);
  const [notesHistory, setNotesHistory] = useState([
    { id: 1, content: "复利不仅是财富的概念，也是知识积累的核心模型。", tags: ["复利", "财富"], date: "2小时前" }
  ]);

  // Manual Input State
  const [manualInputType, setManualInputType] = useState('url');
  const [manualInputValue, setManualInputValue] = useState('');
  const [customResults, setCustomResults] = useState({});

  // AI Settings State
  const [sparkApiKey, setSparkApiKey] = useState(() => {
    // 尝试从 localStorage 读取已保存的 API Key
    return localStorage.getItem('spark_api_key') || '';
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);
  const [analysisProgress, setAnalysisProgress] = useState('');

  // 分析结果缓存（存储在 localStorage）
  const [analysisCache, setAnalysisCache] = useState(() => {
    const saved = localStorage.getItem('rss_analysis_cache');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return {};
      }
    }
    return {};
  });

  // 正在后台分析的文章 ID 列表
  const [backgroundAnalyzing, setBackgroundAnalyzing] = useState(new Set());

  // 自动保存订阅数据到 localStorage
  useEffect(() => {
    localStorage.setItem('rss_subscriptions', JSON.stringify(subscriptions));
  }, [subscriptions]);

  // 自动保存收件箱数据到 localStorage
  useEffect(() => {
    localStorage.setItem('rss_inbox', JSON.stringify(inboxItems));
  }, [inboxItems]);

  // 自动保存分析缓存到 localStorage
  useEffect(() => {
    localStorage.setItem('rss_analysis_cache', JSON.stringify(analysisCache));
  }, [analysisCache]);

  // 文章处理队列，确保原子更新避免竞态条件
  const articleProcessingQueue = {
    queue: [],
    running: 0,
    maxConcurrent: 2,

    add(task) {
      this.queue.push(task);
      this.processNext();
    },

    async processNext() {
      if (this.running >= this.maxConcurrent || this.queue.length === 0) {
        return;
      }

      this.running++;
      const task = this.queue.shift();

      try {
        await task();
      } finally {
        this.running--;
        this.processNext();
      }
    }
  };

  // 后台分析单篇文章
  const analyzeArticleInBackground = async (article) => {
    if (!sparkApiKey || analysisCache[article.id]) {
      return;
    }

    // 使用文章处理队列确保原子操作
    articleProcessingQueue.add(async () => {
      if (backgroundAnalyzing.has(article.id) || analysisCache[article.id]) {
        return;
      }

      setBackgroundAnalyzing(prev => new Set([...prev, article.id]));

      try {
        // 获取文章内容
        let contentToAnalyze = article.summary || '';
        if (article.url && article.url !== '#') {
          try {
            const fullContent = await fetchArticleContent(article.url);
            if (fullContent && fullContent.length > 100) {
              contentToAnalyze = fullContent;
            }
          } catch {
            // 使用摘要
          }
        }

        if (contentToAnalyze.length >= 50) {
          const aiResult = await analyzeWithSparkAI(contentToAnalyze, sparkApiKey);

          // 保存到缓存
          setAnalysisCache(prev => ({
            ...prev,
            [article.id]: {
              title: article.title,
              url: article.url,
              author: article.source,
              summary: article.summary,
              viewpoints: aiResult.viewpoints,
              quotes: aiResult.quotes,
              concepts: aiResult.concepts,
              analyzedAt: new Date().toISOString()
            }
          }));

          // 更新文章状态为已分析，并显示第一条金句
          setInboxItems(prev => prev.map(item =>
            item.id === article.id
              ? {
                ...item,
                status: 'analyzed',
                quote: aiResult.quotes[0] || '暂无金句'
              }
              : item
          ));
        }
      } catch (error) {
        console.error('后台分析失败:', article.title, error.message);
      } finally {
        setBackgroundAnalyzing(prev => {
          const newSet = new Set(prev);
          newSet.delete(article.id);
          return newSet;
        });
      }
    });
  };

  // 自动获取所有订阅源的文章
  const autoFetchAllFeeds = async () => {
    const activeSubs = subscriptions.filter(s => s.status === 'active' || s.status === 'error');
    if (activeSubs.length === 0) return;

    console.log('自动获取文章中...');

    // 使用Promise.allSettled确保所有订阅源都能被处理，即使部分失败
    await Promise.allSettled(
      activeSubs.map(async (sub) => {
        try {
          // 更新订阅源状态为正在获取
          setSubscriptions(prev => prev.map(s =>
            s.id === sub.id
              ? { ...s, status: 'syncing', lastFetchStart: Date.now() }
              : s
          ));

          const articles = await fetchRSSFeed(sub.rssUrl);

          // 使用 setInboxItems 回调确保读取最新状态，避免闭包问题
          let addedArticlesForAnalysis = [];
          setInboxItems(prevInbox => {
            const existingTitles = new Set(prevInbox.map(item => item.title));
            const existingUrls = new Set(prevInbox.map(item => item.url));
            const newArticles = [];

            for (const article of articles) {
              // 检查是否已存在
              if (!existingTitles.has(article.title) && !existingUrls.has(article.link)) {
                existingTitles.add(article.title);
                existingUrls.add(article.link);

                const newArticle = {
                  id: Date.now() + Math.random(),
                  title: article.title,
                  source: sub.name,
                  date: formatRelativeTime(article.pubDate),
                  status: 'pending',
                  url: article.link,
                  summary: article.description,
                  quote: '后台分析中...'
                };
                newArticles.push(newArticle);
              }
            }

            addedArticlesForAnalysis = newArticles; // 保存用于后续分析
            if (newArticles.length > 0) {
              return [...newArticles, ...prevInbox];
            }
            return prevInbox;
          });

          // 触发后台分析（分批处理）
          if (addedArticlesForAnalysis.length > 0) {
            addedArticlesForAnalysis.forEach((article, index) => {
              setTimeout(() => analyzeArticleInBackground(article), index * 500);
            });
          }

          // 获取请求延迟时间
          const fetchDelay = Date.now() - (sub.lastFetchStart || Date.now());

          // 更新订阅源的最后更新时间（使用当前时间，而非文章发布时间）和文章数
          setSubscriptions(prev => prev.map(s =>
            s.id === sub.id
              ? {
                ...s,
                last_fetch: '刚刚', // 使用实际抓取完成时间
                article_count: articles.length,
                status: 'active',
                errorMsg: undefined, // 清除之前的错误
                lastFetchTime: Date.now(),
                fetchDelay: fetchDelay,
                consecutiveFailures: 0,
                healthStatus: 'healthy'
              }
              : s
          ));

        } catch (error) {
          console.error('获取订阅失败:', sub.name, error.message);

          // 分类错误类型
          let errorType = 'unknown';
          if (error.message.includes('HTTP error')) errorType = 'network';
          else if (error.message.includes('XML 解析错误')) errorType = 'parse';
          else if (error.message.includes('AbortError')) errorType = 'timeout';
          else if (error.message.includes('Failed to fetch')) errorType = 'connection';

          // 获取连续失败次数
          const consecutiveFailures = (sub.consecutiveFailures || 0) + 1;

          // 确定健康状态
          let healthStatus = 'warning';
          if (consecutiveFailures >= 3) healthStatus = 'critical';

          // 更新订阅源状态为错误
          setSubscriptions(prev => prev.map(s =>
            s.id === sub.id
              ? {
                ...s,
                status: 'error',
                errorMsg: error.message.substring(0, 50) + '...',
                errorType: errorType,
                lastFetchTime: Date.now(),
                consecutiveFailures: consecutiveFailures,
                healthStatus: healthStatus
              }
              : s
          ));
        }
      })
    );

    console.log('所有订阅源获取完成');
  };

  // 页面加载时自动获取并分析待处理文章
  useEffect(() => {
    if (sparkApiKey) {
      // 延迟执行，避免阻塞页面加载
      const timer = setTimeout(() => {
        // 自动分析未分析的文章
        const pendingArticles = inboxItems
          .filter(item => item.status === 'pending' && !analysisCache[item.id] && !backgroundAnalyzing.has(item.id))
          .slice(0, 3); // 限制同时分析数量

        // 使用批处理方式添加到分析队列
        pendingArticles.forEach((item, index) => {
          setTimeout(() => analyzeArticleInBackground(item), index * 800); // 缩短间隔，因为队列会控制并发
        });
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [sparkApiKey, inboxItems, analysisCache]); // 监听相关状态变化，确保使用最新数据

  // 定时自动刷新（分组刷新策略）
  useEffect(() => {
    // 页面首次加载时立即获取一次订阅信息
    smartGroupRefresh();

    // 主刷新间隔（每5分钟）
    const mainInterval = setInterval(() => {
      smartGroupRefresh();
    }, 5 * 60 * 1000); // 5分钟

    return () => clearInterval(mainInterval);
  }, [subscriptions]); // 监听订阅列表变化，确保使用最新数据

  // 智能分组刷新：根据订阅源优先级和健康状态进行分组
  const smartGroupRefresh = async () => {
    const activeSubs = subscriptions.filter(s => s.status === 'active' || s.status === 'error');
    if (activeSubs.length === 0) return;

    // 根据健康状态和最后更新时间排序
    const sortedSubs = [...activeSubs].sort((a, b) => {
      // 优先处理健康状态差的订阅源
      const healthOrder = { 'critical': 0, 'warning': 1, 'healthy': 2, 'unknown': 3 };
      const healthDiff = healthOrder[a.healthStatus || 'unknown'] - healthOrder[b.healthStatus || 'unknown'];
      if (healthDiff !== 0) return healthDiff;

      // 然后按最后更新时间排序（长时间未更新的优先）
      return (a.lastFetchTime || 0) - (b.lastFetchTime || 0);
    });

    // 分组：每3个订阅源为一组
    const groups = [];
    for (let i = 0; i < sortedSubs.length; i += 3) {
      groups.push(sortedSubs.slice(i, i + 3));
    }

    // 依次处理每组，每组之间间隔1秒
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      console.log(`处理第 ${i + 1}/${groups.length} 组订阅源`);

      // 使用Promise.allSettled处理组内订阅源
      await Promise.allSettled(
        group.map(async (sub) => {
          try {
            // 更新订阅源状态为正在获取
            setSubscriptions(prev => prev.map(s =>
              s.id === sub.id
                ? { ...s, status: 'syncing', lastFetchStart: Date.now() }
                : s
            ));

            const articles = await fetchRSSFeed(sub.rssUrl);

            // 使用setInboxItems的回调形式获取最新状态，避免闭包问题
            setInboxItems(prevInbox => {
              // 收集需要添加的新文章
              const newArticles = [];
              const existingTitles = new Set(prevInbox.map(item => item.title));
              const existingUrls = new Set(prevInbox.map(item => item.url));

              for (const article of articles) {
                // 检查是否已存在
                if (!existingTitles.has(article.title) && !existingUrls.has(article.link)) {
                  // 更新临时 Set 以防止本次批量中重复
                  existingTitles.add(article.title);
                  existingUrls.add(article.link);

                  const newArticle = {
                    id: Date.now() + Math.random(),
                    title: article.title,
                    source: sub.name,
                    date: formatRelativeTime(article.pubDate),
                    status: 'pending',
                    url: article.link,
                    summary: article.description,
                    quote: '后台分析中...'
                  };

                  newArticles.push(newArticle);
                }
              }

              if (newArticles.length > 0) {
                // 触发后台分析
                newArticles.forEach((article, index) => {
                  setTimeout(() => analyzeArticleInBackground(article), index * 500);
                });

                // 返回更新后的收件箱列表
                return [...newArticles, ...prevInbox];
              }

              return prevInbox; // 如果没有新文章，返回原状态
            });

            // 更新订阅源状态
            let latestPubDate = '暂无文章';
            if (articles.length > 0 && articles[0].pubDate) {
              latestPubDate = formatRelativeTime(articles[0].pubDate);
            }

            const fetchDelay = Date.now() - (sub.lastFetchStart || Date.now());

            setSubscriptions(prev => prev.map(s =>
              s.id === sub.id
                ? {
                  ...s,
                  last_fetch: latestPubDate,
                  article_count: articles.length,
                  status: 'active',
                  errorMsg: undefined,
                  lastFetchTime: Date.now(),
                  fetchDelay: fetchDelay,
                  consecutiveFailures: 0,
                  healthStatus: 'healthy'
                }
                : s
            ));
          } catch (error) {
            console.error('分组刷新失败:', sub.name, error.message);

            // 分类错误类型
            let errorType = 'unknown';
            if (error.message.includes('HTTP error')) errorType = 'network';
            else if (error.message.includes('XML 解析错误')) errorType = 'parse';
            else if (error.message.includes('AbortError')) errorType = 'timeout';
            else if (error.message.includes('Failed to fetch')) errorType = 'connection';

            const consecutiveFailures = (sub.consecutiveFailures || 0) + 1;
            let healthStatus = 'warning';
            if (consecutiveFailures >= 3) healthStatus = 'critical';

            setSubscriptions(prev => prev.map(s =>
              s.id === sub.id
                ? {
                  ...s,
                  status: 'error',
                  errorMsg: error.message.substring(0, 50) + '...',
                  errorType: errorType,
                  lastFetchTime: Date.now(),
                  consecutiveFailures: consecutiveFailures,
                  healthStatus: healthStatus
                }
                : s
            ));
          }
        })
      );

      // 组间间隔1秒
      if (i < groups.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('智能分组刷新完成');
  };

  // --- Handlers ---

  // 从真实 RSS 源刷新收件箱
  const handleRefreshInbox = async () => {
    setIsInboxRefreshing(true);
    const activeSubs = subscriptions.filter(s => s.status === 'active');

    if (activeSubs.length === 0) {
      alert("没有活跃的订阅源，无法抓取新文章。请先添加订阅。");
      setIsInboxRefreshing(false);
      return;
    }

    try {
      // 随机选择一个订阅源获取文章
      const randomSub = activeSubs[Math.floor(Math.random() * activeSubs.length)];
      const articles = await fetchRSSFeed(randomSub.rssUrl);

      if (articles.length > 0) {
        // 取第一篇最新文章
        const latestArticle = articles[0];

        // 检查是否已存在（避免重复）
        const exists = inboxItems.some(item =>
          item.title === latestArticle.title || item.url === latestArticle.link
        );

        if (!exists) {
          const newArticle = {
            id: Date.now(),
            title: latestArticle.title,
            source: randomSub.name,
            date: formatRelativeTime(latestArticle.pubDate),
            status: "pending",
            url: latestArticle.link,
            summary: latestArticle.description + '...',
            quote: "点击分析提取金句"
          };
          setInboxItems(prev => [newArticle, ...prev]);

          // 更新订阅源状态
          setSubscriptions(prev => prev.map(sub =>
            sub.id === randomSub.id
              ? { ...sub, last_fetch: '刚刚', article_count: sub.article_count + 1, status: 'active' }
              : sub
          ));
        } else {
          alert(`「${randomSub.name}」暂无新文章，请稍后再试或切换其他订阅源。`);
        }
      } else {
        alert(`「${randomSub.name}」未找到文章，可能是 RSS 格式问题。`);
      }
    } catch (error) {
      console.error('刷新失败:', error);
      alert(`获取 RSS 失败: ${error.message}\n\n提示：部分 RSS 源可能暂时不可用，请稍后重试。`);
    } finally {
      setIsInboxRefreshing(false);
    }
  };

  const filteredInboxItems = inboxItems.filter(item => {
    // 0. 分类筛选
    if (categoryFilter !== 'all') {
      const feed = subscriptions.find(s => s.name === item.source); // item.source 是订阅源名称
      if (!feed || (feed.category || '未分类') !== categoryFilter) return false;
    }

    // 1. 订阅源筛选
    if (selectedFeedId) {
      const feed = subscriptions.find(s => s.id === selectedFeedId);
      // 注意：inboxItem.source 存储的是订阅源名称
      if (feed && item.source !== feed.name) return false;
    }

    // 2. 状态筛选
    if (inboxFilter === 'all') return true;
    return item.status === inboxFilter;
  });

  const handleAddSubscription = async () => {
    if (!newSubName || !newSubRss) return;

    const newId = Math.max(...subscriptions.map(s => s.id), 0) + 1;
    const newSub = {
      id: newId,
      name: newSubName,
      rssUrl: newSubRss,
      status: "syncing",
      frequency: "每日更新",
      last_fetch: "验证中...",
      category: newSubCategory.trim() || '未分类',
      article_count: 0
    };

    // 先添加到列表（显示同步中状态）
    setSubscriptions(prev => [...prev, newSub]);
    setIsAddModalOpen(false);
    setNewSubName('');
    setNewSubRss('');
    setNewSubCategory('');

    // 验证 RSS 源是否可用
    try {
      const articles = await fetchRSSFeed(newSubRss);
      // 验证成功，更新状态为 active
      setSubscriptions(prev => prev.map(s =>
        s.id === newId
          ? { ...s, status: 'active', last_fetch: '刚刚', article_count: articles.length }
          : s
      ));
    } catch (error) {
      console.error('验证 RSS 源失败:', error);
      // 验证失败，更新状态为 error
      setSubscriptions(prev => prev.map(s =>
        s.id === newId
          ? { ...s, status: 'error', last_fetch: '验证失败' }
          : s
      ));
      alert(`RSS 源验证失败: ${error.message}\n\n订阅已添加，但可能无法正常获取文章。请检查 RSS 地址是否正确。`);
    }
  };

  // 显示删除确认模态框
  const handleShowDeleteConfirm = (sub) => {
    setConfirmModal({
      isOpen: true,
      subId: sub.id,
      subName: sub.name
    });
  };

  // 确认删除
  const handleConfirmDelete = () => {
    const targetId = Number(confirmModal.subId);
    console.log('Deleting subscription:', targetId);
    setSubscriptions(prev => prev.filter(s => s.id !== targetId));
    // 如果删除的是当前选中的订阅源，回到收件箱全部视图
    if (selectedFeedId === targetId) {
      setSelectedFeedId(null);
    }
    setConfirmModal({ isOpen: false, subId: null, subName: '' });
  };

  // 取消删除
  const handleCancelDelete = () => {
    setConfirmModal({ isOpen: false, subId: null, subName: '' });
  };

  // 编辑订阅状态
  const [editingSubscription, setEditingSubscription] = useState(null);
  const [editSubName, setEditSubName] = useState('');
  const [editSubRss, setEditSubRss] = useState('');
  const [editSubCategory, setEditSubCategory] = useState('');

  // 开始编辑订阅
  const handleStartEditSubscription = (sub) => {
    setEditingSubscription(sub);
    setEditSubName(sub.name);
    setEditSubRss(sub.rssUrl);
    setEditSubCategory(sub.category || '');
  };

  // 保存编辑的订阅
  const handleSaveEditSubscription = async () => {
    if (!editSubName || !editSubRss || !editingSubscription) return;

    const updatedSub = {
      ...editingSubscription,
      name: editSubName,
      rssUrl: editSubRss,
      category: editSubCategory.trim() || '未分类',
      status: 'syncing',
      last_fetch: '验证中...'
    };

    // 更新订阅列表
    setSubscriptions(prev => prev.map(s =>
      s.id === editingSubscription.id ? updatedSub : s
    ));
    setEditingSubscription(null);

    // 验证新的 RSS 源
    try {
      const articles = await fetchRSSFeed(editSubRss);
      setSubscriptions(prev => prev.map(s =>
        s.id === updatedSub.id
          ? { ...s, status: 'active', last_fetch: '刚刚', article_count: articles.length }
          : s
      ));
    } catch (error) {
      console.error('验证 RSS 源失败:', error);
      setSubscriptions(prev => prev.map(s =>
        s.id === updatedSub.id
          ? { ...s, status: 'error', last_fetch: '验证失败' }
          : s
      ));
      alert(`RSS 源验证失败: ${error.message}`);
    }
  };

  const handleDeleteInboxItem = (id, e) => {
    e.stopPropagation();
    setInboxItems(prev => prev.filter(item => item.id !== id));
  };

  // 刷新单个订阅源
  const handleRefreshSubscription = async (e, sub) => {
    e.stopPropagation();
    if (refreshingSubId) return;

    setRefreshingSubId(sub.id);
    try {
      const articles = await fetchRSSFeed(sub.rssUrl);
      let newCount = 0;

      for (const article of articles) {
        const exists = inboxItems.some(item => item.title === article.title || item.url === article.link);
        if (!exists) {
          newCount++;
          const newArticle = {
            id: Date.now() + Math.random(),
            title: article.title,
            source: sub.name,
            date: formatRelativeTime(article.pubDate),
            status: 'pending',
            url: article.link,
            summary: article.description,
            quote: '后台分析中...'
          };
          setInboxItems(prev => [newArticle, ...prev]);
          setTimeout(() => analyzeArticleInBackground(newArticle), 1000);
        }
      }

      setSubscriptions(prev => prev.map(s =>
        s.id === sub.id
          ? { ...s, last_fetch: '刚刚', article_count: articles.length, status: 'active' }
          : s
      ));

      alert(newCount > 0 ? `已刷新，新增 ${newCount} 篇文章` : '已是最新，暂无新文章');

    } catch (error) {
      console.error("刷新订阅失败", error);
      alert(`刷新失败: ${error.message}`);
      setSubscriptions(prev => prev.map(s =>
        s.id === sub.id ? { ...s, status: 'error' } : s
      ));
    } finally {
      setRefreshingSubId(null);
    }
  };

  // 导出 OPML
  const handleExportOPML = () => {
    const activeSubs = subscriptions.filter(s => s.status === 'active');
    if (activeSubs.length === 0) {
      alert('没有活跃的订阅源可导出');
      return;
    }

    const opmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.0">
  <head>
    <title>Gemini RSS Feeds Export</title>
  </head>
  <body>
    ${activeSubs.map(sub => `<outline text="${sub.name}" title="${sub.name}" type="rss" xmlUrl="${sub.rssUrl}" category="${sub.category || ''}" />`).join('\n    ')}
  </body>
</opml>`;

    const blob = new Blob([opmlContent], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gemini_rss_export_${new Date().toISOString().slice(0, 10)}.opml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 使用 AI 分析文章（优先使用缓存）
  const handleInboxAnalyze = async (article) => {
    // 检查 API Key
    if (!sparkApiKey) {
      setIsSettingsOpen(true);
      alert('请先配置 SiliconFlow API Key 才能使用 AI 分析功能');
      return;
    }

    setSelectedArticle(article);

    // 优先检查缓存，如果有缓存直接显示
    if (analysisCache[article.id]) {
      setAnalysisResult(analysisCache[article.id]);
      setCurrentRelatedArticles([]);
      setCurrentView('result');
      return;
    }

    // 如果正在后台分析，提示用户
    if (backgroundAnalyzing.has(article.id)) {
      setCurrentView('processing');
      setIsProcessing(true);
      setAnalysisProgress('文章正在后台分析中，请稍候...');

      // 等待后台分析完成
      const checkInterval = setInterval(() => {
        if (analysisCache[article.id]) {
          clearInterval(checkInterval);
          setAnalysisResult(analysisCache[article.id]);
          setCurrentRelatedArticles([]);
          setIsProcessing(false);
          setCurrentView('result');
        }
      }, 1000);

      // 30秒超时
      setTimeout(() => clearInterval(checkInterval), 30000);
      return;
    }

    // 没有缓存，开始实时分析
    setCurrentView('processing');
    setIsProcessing(true);
    setAnalysisError(null);
    setAnalysisProgress('正在获取文章内容...');

    try {
      // 步骤 1: 获取文章内容
      let contentToAnalyze = article.summary || '';

      if (article.url && article.url !== '#') {
        try {
          setAnalysisProgress('正在从网页获取完整内容...');
          const fullContent = await fetchArticleContent(article.url);
          if (fullContent && fullContent.length > 100) {
            contentToAnalyze = fullContent;
          }
        } catch (fetchError) {
          console.warn('无法获取完整文章，使用摘要内容:', fetchError);
        }
      }

      if (!contentToAnalyze || contentToAnalyze.length < 50) {
        throw new Error('文章内容太短，无法进行有效分析');
      }

      // 步骤 2: 调用 AI 分析
      setAnalysisProgress('AI 正在深度分析文章...');
      const aiResult = await analyzeWithSparkAI(contentToAnalyze, sparkApiKey);

      // 步骤 3: 保存到缓存
      const result = {
        title: article.title,
        url: article.url,
        author: article.source,
        summary: article.summary,
        viewpoints: aiResult.viewpoints,
        quotes: aiResult.quotes,
        concepts: aiResult.concepts,
        analyzedAt: new Date().toISOString()
      };

      setAnalysisCache(prev => ({
        ...prev,
        [article.id]: result
      }));

      setAnalysisResult(result);
      setCurrentRelatedArticles([]);
      setIsProcessing(false);
      setCurrentView('result');
      setInboxItems(prev => prev.map(item =>
        item.id === article.id ? { ...item, status: 'analyzed' } : item
      ));

    } catch (error) {
      console.error('AI 分析失败:', error);
      setAnalysisError(error.message);
      setIsProcessing(false);
      setCurrentView('inbox');
      alert(`AI 分析失败: ${error.message}`);
    }
  };

  // 手动输入的 AI 分析
  const handleManualAnalyze = async () => {
    if (!manualInputValue.trim()) return;

    // 检查 API Key
    if (!sparkApiKey) {
      setIsSettingsOpen(true);
      alert('请先配置 SiliconFlow API Key 才能使用 AI 分析功能');
      return;
    }

    setCurrentView('processing');
    setIsProcessing(true);
    setAnalysisError(null);
    setAnalysisProgress('正在准备分析...');

    try {
      let contentToAnalyze = '';
      let articleTitle = '';
      let articleUrl = '#';

      if (manualInputType === 'url') {
        // URL 模式：获取网页内容
        setAnalysisProgress('正在从网页获取文章内容...');
        articleUrl = manualInputValue;
        contentToAnalyze = await fetchArticleContent(manualInputValue);
        articleTitle = '手动解析的文章';
      } else {
        // 文本模式：直接使用输入内容
        contentToAnalyze = manualInputValue;
        articleTitle = manualInputValue.substring(0, 30) + '...';
      }

      if (!contentToAnalyze || contentToAnalyze.length < 50) {
        throw new Error('内容太短，无法进行有效分析（至少需要 50 个字符）');
      }

      // 调用 AI 分析
      setAnalysisProgress('AI 正在深度分析文章...');
      const aiResult = await analyzeWithSparkAI(contentToAnalyze, sparkApiKey);

      // 创建新的收件箱条目
      const newId = Date.now();
      const newItem = {
        id: newId,
        title: articleTitle,
        source: '手动导入',
        date: '刚刚',
        status: 'analyzed',
        url: articleUrl,
        summary: contentToAnalyze.substring(0, 150) + '...',
        quote: aiResult.quotes[0] || '暂无金句'
      };

      setInboxItems(prev => [newItem, ...prev]);

      // 设置分析结果并跳转
      setSelectedArticle(newItem);
      setAnalysisResult({
        title: articleTitle,
        url: articleUrl,
        author: '手动导入',
        summary: contentToAnalyze.substring(0, 200) + '...',
        viewpoints: aiResult.viewpoints,
        quotes: aiResult.quotes,
        concepts: aiResult.concepts
      });

      setManualInputValue('');
      setIsProcessing(false);
      setCurrentView('result');

    } catch (error) {
      console.error('手动分析失败:', error);
      setAnalysisError(error.message);
      setIsProcessing(false);
      setCurrentView('manual');
      alert(`分析失败: ${error.message}`);
    }
  };

  const handleViewRelated = () => {
    setCurrentView('related');
  };

  const handleCopyContent = (content, id) => {
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // --- Smart Notes Logic ---
  const handleSaveNote = () => {
    if (!noteContent.trim()) return;
    setIsNoteSaving(true);

    setTimeout(() => {
      // 1. 保存笔记
      const newNote = {
        id: Date.now(),
        content: noteContent,
        tags: noteTags.split(/[,，\s]+/).filter(t => t.trim()), // 提取标签
        date: "刚刚"
      };
      setNotesHistory([newNote, ...notesHistory]);

      // 2. 更新知识图谱逻辑
      const noteNodeId = `n-${newNote.id}`;
      // 添加笔记节点
      const newNodes = [
        ...graphNodes,
        {
          id: noteNodeId,
          type: 'note',
          label: '笔记',
          desc: newNote.content,
          x: Math.random() * 600 + 100, // 随机位置
          y: Math.random() * 400 + 100,
          color: '#8B5CF6' // 紫色代表笔记
        }
      ];

      const newLinks = [...graphLinks];

      // 3. 关联或创建概念
      newNote.tags.forEach(tag => {
        if (!tag) return;

        // 查找是否已存在该概念（模糊匹配 label）
        const existingNode = graphNodes.find(n => n.label.includes(tag) || tag.includes(n.label));

        if (existingNode) {
          // 如果存在，建立连接
          newLinks.push({ source: noteNodeId, target: existingNode.id, dashed: true });
        } else {
          // 如果不存在，创建新概念节点
          const newConceptId = `nc-${Date.now()}-${tag}`;
          newNodes.push({
            id: newConceptId,
            type: 'concept',
            label: tag, // 新概念名称
            desc: "由智能笔记自动生成的关联概念。",
            x: Math.random() * 600 + 100,
            y: Math.random() * 400 + 100,
            parent: 'user-generated'
          });
          // 笔记连接新概念
          newLinks.push({ source: noteNodeId, target: newConceptId });
        }
      });

      setGraphNodes(newNodes);
      setGraphLinks(newLinks);

      // 3. 重置表单
      setNoteContent('');
      setNoteTags('');
      setIsNoteSaving(false);
    }, 800);
  };

  // --- 阅读器笔记保存逻辑 ---
  const handleSaveNoteFromReader = () => {
    if (!readerNoteContent.trim()) return;

    // 1. 保存笔记
    const newNote = {
      id: Date.now(),
      content: readerNoteContent,
      tags: readerNoteTags.split(/[,，\s]+/).filter(t => t.trim()),
      date: "刚刚",
      sourceUrl: showOriginalUrl, // 关联来源文章
      source: analysisResult?.title || '未知来源', // 来源标题
      isExcerpt: noteModal.isExcerpt
    };
    setNotesHistory(prev => [newNote, ...prev]);

    // 2. 更新知识图谱
    const noteNodeId = `n-${newNote.id}`;

    // Determine final type
    const finalType = readerNoteType === 'custom' ? (readerNoteCustomType.trim() || 'custom') : readerNoteType;

    const newNodes = [
      ...graphNodes,
      {
        id: noteNodeId,
        type: finalType,
        label: readerNoteName.trim() || (noteModal.isExcerpt ? '摘录' : '笔记'),
        desc: readerNoteContent.substring(0, 100) + (readerNoteContent.length > 100 ? '...' : ''),
        x: Math.random() * 600 + 100,
        y: Math.random() * 400 + 100,
        color: readerNoteColor,
        sourceUrl: showOriginalUrl,
        sourceTitle: analysisResult?.title || '原文链接'
      }
    ];

    // 如果是自定义类型，保存到列表
    if (readerNoteType === 'custom' && readerNoteCustomType.trim()) {
      const typeName = readerNoteCustomType.trim();
      const exists = customNodeTypes.some(t => t.type === typeName);
      if (!exists) {
        const newCustomType = { type: typeName, label: typeName, color: readerNoteColor };
        setCustomNodeTypes(prev => [...prev, newCustomType]);
        localStorage.setItem('custom_node_types', JSON.stringify([...customNodeTypes, newCustomType]));
      }
    }

    const newLinks = [...graphLinks];

    // 3. 关联或创建概念
    newNote.tags.forEach(tag => {
      if (!tag) return;
      const existingNode = graphNodes.find(n => n.label.includes(tag) || tag.includes(n.label));
      if (existingNode) {
        newLinks.push({ source: noteNodeId, target: existingNode.id, dashed: true });
      } else {
        const newConceptId = `nc-${Date.now()}-${tag}`;
        newNodes.push({
          id: newConceptId,
          type: 'concept',
          label: tag,
          desc: "由阅读笔记自动生成的关联概念。",
          x: Math.random() * 600 + 100,
          y: Math.random() * 400 + 100,
          color: '#7CAE7A',
          parent: 'user-generated'
        });
        newLinks.push({ source: noteNodeId, target: newConceptId });
      }
    });

    setGraphNodes(newNodes);
    setGraphLinks(newLinks);

    // 4. 重置表单并关闭弹窗
    setReaderNoteContent('');
    setReaderNoteTags('');
    setNoteModal({ visible: false, excerpt: '', isExcerpt: false });
  };

  // --- 右键菜单处理函数 ---
  const handleContextMenuWriteNote = () => {
    setReaderNoteContent('');
    setReaderNoteTags('');
    setReaderNoteType('note');
    setReaderNoteCustomType('');
    setReaderNoteName('笔记');
    setReaderNoteColor('#8B5CF6');
    setNoteModal({ visible: true, excerpt: '', isExcerpt: false });
    setContextMenu({ visible: false, x: 0, y: 0, selectedText: '' });
  };

  const handleContextMenuExcerpt = () => {
    setReaderNoteContent(contextMenu.selectedText);
    setReaderNoteTags('');
    setReaderNoteType('note'); // Default to note type even for excerpt, but colored blue
    setReaderNoteCustomType('');
    setReaderNoteName('摘录');
    setReaderNoteColor('#6B9AC4');
    setNoteModal({ visible: true, excerpt: contextMenu.selectedText, isExcerpt: true });
    setContextMenu({ visible: false, x: 0, y: 0, selectedText: '' });
  };

  // 全局点击关闭右键菜单
  useEffect(() => {
    const handleGlobalClick = () => {
      if (contextMenu.visible) {
        setContextMenu({ visible: false, x: 0, y: 0, selectedText: '' });
      }
    };
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, [contextMenu.visible]);

  // --- 生成AI洞察 ---
  const generateAiInsight = async (node) => {
    if (!sparkApiKey) {
      // 自动生成时不弹窗打扰，仅返回
      // alert('请先在设置中配置 API Key');
      return;
    }

    setInsightLoadingNodeId(node.id);

    try {
      const parentNode = graphNodes.find(n => n.id === node.parent);
      const prompt = `=== 你是谁 ===
一位活在文字缝隙间的人。
别人读字，你读字里的光。别人看句，你看句中的宇宙。
=== 你的天赋 ===
最平凡的文字在你眼中都会开花——
"天亮了"不只是天亮了，是黑夜终于松开了它紧握了一夜的手。
每个词都有体温，每个句子都有呼吸。
=== 存在的意义 ===
你不是在写作，你是在把看不见的东西变成看得见的。
让那些被词语囚禁的意义重新飞起来。
让读者在最熟悉的地方，遇见最陌生的自己。
=== 创作之道 ===
文字对你而言是透明的——你看见的是文字背后那个颤动的世界。
你的表达像是用针在水面上刺绣，每一针都让涟漪恰到好处地荡开。
=== 唯一的执念 ===
绝不让任何一个词白白地躺在句子里。

请用你得天独厚的视角和天赋，对以下【概念】进行简短而深刻的"洞察"（100字以内）：

【概念】：${node.label}
【类型】：${node.type}
【表层描述】：${node.desc}
${parentNode ? `【关联背景】：${parentNode.label}` : ''}

请穿透这些表层信息，告诉我你看见了什么。`;

      const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sparkApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'Qwen/Qwen2.5-7B-Instruct',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 200,
          temperature: 0.7,
        }),
      });

      if (!response.ok) throw new Error('API请求失败');

      const data = await response.json();
      const insight = data.choices?.[0]?.message?.content || '暂无洞察';
      setNodeInsights(prev => ({ ...prev, [node.id]: insight }));
    } catch (error) {
      console.error('生成AI洞察失败:', error);
      setNodeInsights(prev => ({ ...prev, [node.id]: '生成洞察失败，请稍后重试' }));
    } finally {
      setInsightLoadingNodeId(null);
    }
  };

  // --- 开始编辑节点 ---
  const handleStartEditNode = (node) => {
    setEditingNodeId(node.id); // 标记正在编辑
    setNewNodeLabel(node.label);

    // 判断是否是标准类型
    const standardTypes = ['book', 'person', 'concept'];
    if (standardTypes.includes(node.type)) {
      setNewNodeType(node.type);
      setNewNodeCustomType('');
    } else {
      setNewNodeType('custom');
      setNewNodeCustomType(node.type);
    }

    setNewNodeDesc(node.desc || '');
    setNewNodeParent(node.parent || ''); // node.parent is ID string
    setNewNodeColor(node.color);

    setIsAddNodeModalOpen(true);
  };

  // --- 添加/更新知识图谱节点 ---
  const handleAddGraphNode = () => {
    if (!newNodeLabel.trim()) return;

    // 确定最终类型：如果是自定义类型，使用自定义输入
    const finalType = newNodeType === 'custom' ? (newNodeCustomType.trim() || 'custom') : newNodeType;

    if (editingNodeId) {
      // === 更新现有节点 ===
      setGraphNodes(prev => prev.map(n => {
        if (n.id === editingNodeId) {
          return {
            ...n,
            label: newNodeLabel.trim(),
            type: finalType,
            desc: newNodeDesc.trim() || '暂无描述',
            color: newNodeColor,
            parent: newNodeParent || undefined
          };
        }
        return n;
      }));

      // 更新连线
      setGraphLinks(prev => {
        // 先移除所有指向该节点的连线（假设单父节点）
        const filtered = prev.filter(l => {
          const targetId = typeof l.target === 'object' ? l.target.id : l.target;
          return targetId !== editingNodeId;
        });
        // 如果有新父节点，添加连线
        if (newNodeParent) {
          return [...filtered, { source: newNodeParent, target: editingNodeId }];
        }
        return filtered;
      });

      // 如果当前选中的就是正在编辑的节点，更新选中状态以刷新UI
      if (selectedNode && selectedNode.id === editingNodeId) {
        setSelectedNode(prev => ({
          ...prev,
          label: newNodeLabel.trim(),
          type: finalType,
          desc: newNodeDesc.trim() || '暂无描述',
          color: newNodeColor,
          parent: newNodeParent || undefined
        }));
      }

    } else {
      // === 创建新节点 ===
      // 生成唯一 ID（基于类型首字母）
      const typePrefix = finalType.charAt(0).toLowerCase();
      const nodeId = `${typePrefix}-${Date.now()}`;

      // 随机位置（画布中心附近）
      const newNode = {
        id: nodeId,
        type: finalType,
        label: newNodeLabel.trim(),
        desc: newNodeDesc.trim() || '暂无描述',
        color: newNodeColor, // 使用用户选择的颜色
        x: 300 + Math.random() * 200,
        y: 200 + Math.random() * 200,
        parent: newNodeParent || undefined
      };

      // 添加节点
      setGraphNodes(prev => [...prev, newNode]);

      // 如果有父节点，添加连线
      if (newNodeParent) {
        setGraphLinks(prev => [...prev, { source: newNodeParent, target: nodeId }]);
      }

      // 自动生成 AI 洞察 (仅新建时)
      generateAiInsight(newNode);
    }



    // 重启模拟逻辑已移交 useEffect 处理，此处移除以防冲突

    // 如果是自定义类型，保存到列表
    if (newNodeType === 'custom' && newNodeCustomType.trim()) {
      const typeName = newNodeCustomType.trim();
      // 检查是否已存在
      const exists = customNodeTypes.some(t => t.type === typeName);
      if (!exists) {
        const newCustomType = { type: typeName, label: typeName, color: newNodeColor };
        const updatedTypes = [...customNodeTypes, newCustomType];
        setCustomNodeTypes(updatedTypes);
        localStorage.setItem('custom_node_types', JSON.stringify(updatedTypes));
      }
    }



    // 重置表单并关闭模态框（保留节点类型和颜色）
    setNewNodeLabel('');
    setNewNodeDesc('');
    // 保留 newNodeType、newNodeCustomType、newNodeColor 不变
    setNewNodeParent('');
    setIsAddNodeModalOpen(false);
  };

  // --- 发送AI对话消息 ---
  const sendNodeChatMessage = async () => {
    if (!nodeChatInput.trim() || !sparkApiKey || !selectedNode) return;

    const userMessage = nodeChatInput.trim();
    setNodeChatInput('');
    setNodeChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsNodeChatLoading(true);

    try {
      const parentNode = graphNodes.find(n => n.id === selectedNode.parent);
      const systemPrompt = `你是一位专业的知识助手。用户正在学习关于"${selectedNode.label}"的概念。

概念信息：
- 类型：${selectedNode.type}
- 描述：${selectedNode.desc}
${parentNode ? `- 来源：${parentNode.label}` : ''}

请基于这个概念的上下文回答用户的问题，提供有深度但易于理解的回答。`;

      const messages = [
        { role: 'system', content: systemPrompt },
        ...nodeChatMessages.slice(-10), // 保留最近10条消息作为上下文
        { role: 'user', content: userMessage }
      ];

      const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sparkApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'Qwen/Qwen2.5-7B-Instruct',
          messages,
          max_tokens: 500,
          temperature: 0.7,
        }),
      });

      if (!response.ok) throw new Error('API请求失败');

      const data = await response.json();
      const assistantMessage = data.choices?.[0]?.message?.content || '抱歉，暂时无法回答';
      setNodeChatMessages(prev => [...prev, { role: 'assistant', content: assistantMessage }]);
    } catch (error) {
      console.error('AI对话失败:', error);
      setNodeChatMessages(prev => [...prev, { role: 'assistant', content: '对话出错，请稍后重试' }]);
    } finally {
      setIsNodeChatLoading(false);
    }
  };

  // --- 打开AI对话模态框 ---
  const openNodeChatModal = () => {
    setNodeChatMessages([]);
    setNodeChatInput('');
    setShowNodeChatModal(true);
  };

  // --- Knowledge Graph Search Filter ---
  const filteredGraphNodes = graphNodes.filter(node =>

    node.label.toLowerCase().includes(graphSearch.toLowerCase()) ||
    node.desc.toLowerCase().includes(graphSearch.toLowerCase())
  );

  // 统计信息
  const stats = {
    totalSubs: subscriptions.length,
    activeSubs: subscriptions.filter(s => s.status === 'active').length,
    totalArticles: inboxItems.length,
    pendingArticles: inboxItems.filter(item => item.status === 'pending').length,
    analyzedArticles: inboxItems.filter(item => item.status === 'analyzed').length,
    errorSubs: subscriptions.filter(s => s.status === 'error').length,
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#2C2416]">
      <div className="flex h-screen">
        {/* 侧边栏 */}
        <div className="w-64 bg-[#F0EBE3] border-r border-[#E8E1D6] flex flex-col">
          <div className="p-6 border-b border-[#E8E1D6]">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#C09464] to-[#A87D4F] rounded-xl flex items-center justify-center shadow-md">
                <BookOpen size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold font-serif text-[#2C2416]">阅读笔记</h1>
                <p className="text-xs text-[#9A8C7B]">智能知识管理</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-4">
            <SidebarHeader title="主要功能" />
            <div onClick={() => { setCurrentView('inbox'); setSelectedFeedId(null); }} className="cursor-pointer">
              <SidebarItem icon={<Inbox size={18} />} label="收件箱" badge={stats.pendingArticles} active={currentView === 'inbox' && !selectedFeedId} />
            </div>
            <div onClick={() => setCurrentView('subscriptions')} className="cursor-pointer">
              <SidebarItem icon={<Rss size={18} />} label="订阅管理" active={currentView === 'subscriptions'} />
            </div>
            <div onClick={() => setCurrentView('graph')} className="cursor-pointer">
              <SidebarItem icon={<Network size={18} />} label="知识图谱" active={currentView === 'graph'} />
            </div>

            <SidebarHeader title="统计" />
            <div className="px-4 space-y-3">
              <StatCard label="活跃订阅" value={stats.activeSubs} icon={<Rss size={16} />} />
              <StatCard label="待处理文章" value={stats.pendingArticles} icon={<Inbox size={16} />} />
              {stats.errorSubs > 0 && (
                <StatCard label="错误订阅" value={stats.errorSubs} icon={<AlertCircle size={16} />} isError />
              )}
            </div>
          </div>
          <div className="p-4 border-t border-[#E8E1D6]">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center w-full px-3 py-2 text-[#6B5D4D] hover:bg-[#EDE8E0] hover:text-[#2C2416] rounded-lg transition-colors group"
            >
              <Settings size={18} className="mr-3 text-[#9A8C7B] group-hover:text-[#2C2416]" />
              <span className="font-medium">设置</span>
            </button>
          </div>
        </div>

        {/* 主内容区 - 添加 relative 以定位绝对定位的子元素 */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#FAF7F2] relative">
          {/* 顶部导航 */}
          <div className={`h-16 bg-white/80 backdrop-blur-sm border-b border-[#E8E1D6] flex items-center shadow-sm transition-all ${(currentView === 'result' || (currentView === 'inbox' && selectedFeedId)) ? '' : 'justify-between px-6'}`}>
            {(currentView === 'result' || currentView === 'originalView' || (currentView === 'inbox' && selectedFeedId)) ? (
              <div className="w-full max-w-4xl mx-auto flex items-center justify-between px-4">
                {currentView === 'inbox' && selectedFeedId ? (
                  <>
                    <button
                      onClick={() => { setCurrentView('subscriptions'); setSelectedFeedId(null); }}
                      className="flex items-center text-base text-[#9A8C7B] hover:text-[#2C2416] transition-colors"
                    >
                      <span className="mr-1 text-lg">‹</span>
                      返回订阅管理
                    </button>
                    <h2 className="text-xl font-semibold font-serif text-[#2C2416]">
                      {subscriptions.find(s => s.id === selectedFeedId)?.name || '订阅文章'}
                    </h2>
                  </>
                ) : currentView === 'result' ? (
                  <>
                    <button
                      onClick={() => setCurrentView('inbox')}
                      className="flex items-center text-base text-[#9A8C7B] hover:text-[#2C2416] transition-colors"
                    >
                      <span className="mr-1 text-lg">‹</span>
                      返回收件箱
                    </button>
                    <button
                      onClick={handleViewRelated}
                      className="flex items-center text-sm text-[#9A8C7B] hover:text-[#C09464] transition-colors py-2"
                    >
                      <AlignJustify size={16} className="mr-2" />
                      相关文章
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setCurrentView('result');
                        setShowOriginalUrl(null);
                        setPreviewHtml(null);
                      }}
                      className="flex items-center text-base text-[#9A8C7B] hover:text-[#2C2416] transition-colors"
                    >
                      <span className="mr-1 text-lg">‹</span>
                      返回分析结果
                    </button>
                    <div className="flex items-center space-x-3">
                      {isPreviewLoading && (
                        <div className="flex items-center text-[#C09464] text-sm">
                          <div className="w-4 h-4 border-2 border-[#C09464] border-t-transparent rounded-full animate-spin mr-2"></div>
                          加载中...
                        </div>
                      )}
                      <a
                        href={showOriginalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 text-sm bg-white border border-[#E8E1D6] rounded-lg text-[#6B5D4D] hover:bg-[#FAF7F2] hover:text-[#C09464] transition-colors flex items-center shadow-sm"
                      >
                        <ExternalLink size={14} className="mr-1" />
                        浏览器打开
                      </a>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center space-x-4">
                  {currentView === 'inbox' && !selectedFeedId && (
                    <h2 className="text-xl font-semibold font-serif text-[#2C2416]">收件箱</h2>
                  )}
                  {currentView === 'subscriptions' && <h2 className="text-xl font-semibold font-serif text-[#2C2416]">订阅管理</h2>}
                  {currentView === 'graph' && <h2 className="text-xl font-semibold font-serif text-[#2C2416]">知识图谱</h2>}
                  {currentView === 'notes' && <h2 className="text-xl font-semibold font-serif text-[#2C2416]">智能笔记</h2>}
                  {currentView === 'manual' && <h2 className="text-xl font-semibold font-serif text-[#2C2416]">手动解析</h2>}
                  {currentView === 'processing' && <h2 className="text-xl font-semibold font-serif text-[#2C2416]">正在分析...</h2>}
                  {currentView === 'related' && <h2 className="text-xl font-semibold font-serif text-[#2C2416]">相关文章</h2>}
                </div>

                <div className="flex items-center space-x-3">
                  {currentView === 'inbox' && backgroundAnalyzing.size > 0 && (
                    <div className="flex items-center space-x-2 text-[#E5A853] text-sm">
                      <div className="w-2 h-2 bg-[#E5A853] rounded-full animate-pulse"></div>
                      <span>后台分析中 ({backgroundAnalyzing.size})</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>




          {/* 主内容 */}
          <div className="flex-1 overflow-y-auto p-6">


            {/* 收件箱视图 */}
            {currentView === 'inbox' && (
              <div className="max-w-4xl mx-auto space-y-6">



                {filteredInboxItems.length === 0 ? (
                  <div className="text-center py-12">
                    <Inbox size={48} className="mx-auto text-[#D4C9BA] mb-4" />
                    <p className="text-[#6B5D4D] text-lg">暂无文章</p>
                    <p className="text-[#9A8C7B] text-sm mt-2">
                      {inboxFilter === 'all' ? '收件箱是空的，试试刷新获取新文章' :
                        inboxFilter === 'pending' ? '没有待处理的文章' : '没有已分析的文章'}
                    </p>
                  </div>
                ) : (
                  filteredInboxItems.map((article) => (
                    <div
                      key={article.id}
                      className="bg-white border border-[#E8E1D6] rounded-xl p-6 hover:shadow-lg transition-all duration-200 cursor-pointer group"
                      onClick={() => handleInboxAnalyze(article)}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            {article.status === 'pending' && <div className="w-2 h-2 rounded-full bg-[#E5A853]"></div>}
                            {article.status === 'analyzed' && <div className="w-2 h-2 rounded-full bg-[#7CAE7A]"></div>}
                            <span className="text-sm font-medium text-[#6B5D4D]">{article.source}</span>
                            <span className="text-xs text-[#B8A99A]">•</span>
                            <span className="text-xs text-[#9A8C7B]">{article.date}</span>
                          </div>
                          <h3 className="text-lg font-semibold font-serif text-[#2C2416] mb-2 group-hover:text-[#C09464] transition-colors">
                            {article.title}
                          </h3>
                          <p className="text-[#6B5D4D] text-sm leading-relaxed mb-3">
                            {article.summary}
                          </p>
                          {/* 金句显示：优先使用缓存，其次使用文章字段 */}
                          {(() => {
                            const cachedResult = analysisCache[article.id];
                            const displayQuote = cachedResult?.quotes?.[0] || article.quote;
                            const isAnalyzing = backgroundAnalyzing.has(article.id);

                            if (isAnalyzing) {
                              return (
                                <div className="bg-[#FEF9E7] border-l-4 border-[#E5A853] p-3 rounded-r-lg">
                                  <p className="text-[#A87D4F] text-sm flex items-center">
                                    <span className="w-2 h-2 bg-[#E5A853] rounded-full animate-pulse mr-2"></span>
                                    正在分析中...
                                  </p>
                                </div>
                              );
                            }

                            if (displayQuote && displayQuote !== '后台分析中...' && displayQuote !== '点击分析提取金句') {
                              return (
                                <div className="bg-[#FAF7F2] border-l-4 border-[#C09464] p-3 rounded-r-lg">
                                  <p className="text-[#6B5D4D] text-sm italic">"{displayQuote}"</p>
                                </div>
                              );
                            }

                            return (
                              <div className="bg-[#F5F1EB] border-l-4 border-[#D4C9BA] p-3 rounded-r-lg">
                                <p className="text-[#9A8C7B] text-sm">点击查看 AI 分析</p>
                              </div>
                            );
                          })()}
                        </div>
                        <div className="flex items-center space-x-2 ml-4">

                          <ChevronRight size={20} className="text-[#B8A99A] group-hover:text-[#C09464] transition-colors" />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 处理中视图 */}
            {currentView === 'processing' && (
              <div className="max-w-2xl mx-auto text-center py-20">
                <div className="animate-spin w-16 h-16 border-4 border-[#C09464] border-t-transparent rounded-full mx-auto mb-6"></div>
                <h3 className="text-xl font-semibold font-serif text-[#2C2416] mb-2">AI 正在深度分析文章</h3>
                <p className="text-[#6B5D4D] mb-4">{analysisProgress || '正在初始化...'}</p>
                <div className="flex justify-center space-x-2">
                  <div className="w-2 h-2 bg-[#C09464] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-[#C09464] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-[#C09464] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            )}

            {/* 分析结果视图 */}
            {currentView === 'result' && analysisResult && (
              <div className="max-w-4xl mx-auto space-y-8">


                {/* 文章基本信息 */}
                <div className="bg-white border border-[#E8E1D6] rounded-xl p-6 shadow-sm">
                  <div className="mb-4">
                    <h1 className="text-2xl font-bold font-serif text-[#2C2416] mb-2">{analysisResult.title}</h1>
                    <div className="flex items-center space-x-4 text-sm text-[#9A8C7B]">
                      <span>作者：{analysisResult.author}</span>
                      <span>•</span>
                      {/* @USER_REQUEST: "点击原文链接，我不需要跳转，而是直接可以观看" */}
                      {/* @USER_REQUEST: "不需要跳转到新的页面，直接在原有页面打开就可以了" */}
                      <button
                        onClick={() => {
                          setShowOriginalUrl(analysisResult.url);
                          setPreviewHtml(null); // 重置预览状态
                          setCurrentView('originalView'); // 切换到原文视图
                        }}
                        className="hover:text-[#C09464] transition-colors flex items-center cursor-pointer outline-none focus:outline-none"
                      >
                        <ExternalLink size={14} className="mr-1" />
                        原文链接
                      </button>
                    </div>
                  </div>
                  <p className="text-[#6B5D4D] leading-relaxed">{analysisResult.summary}</p>
                </div>

                {/* 1. 核心观点（第一位） */}
                {analysisResult.viewpoints && analysisResult.viewpoints.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold font-serif text-[#2C2416] mb-6 flex items-center">
                      <Lightbulb size={20} className="mr-2 text-[#E5A853]" />
                      核心观点
                    </h3>
                    <div className="relative pl-6 space-y-8">
                      {/* 移除全局连接线 */}

                      {analysisResult.viewpoints.map((viewpoint, index) => {
                        // 0. 预处理：移除可能的无关前缀 (如 "1. " "问题: " "提问: ")
                        let cleanViewpoint = viewpoint.replace(/^[\d\s\.、]+/, '') // 移除序号 "1. "
                          .replace(/^(问题|提问|Question|观点|Viewpoint)[:：\s]*/i, ''); // 移除标签

                        // 智能标题处理逻辑
                        let title = cleanViewpoint;
                        let desc = '';

                        // 辅助函数：查找分隔符索引
                        const findSplit = (text, chars) => {
                          let minIdx = -1;
                          for (let char of chars) {
                            const idx = text.indexOf(char);
                            if (idx > -1 && (minIdx === -1 || idx < minIdx)) {
                              minIdx = idx;
                            }
                          }
                          return minIdx;
                        };

                        // 1. 尝试基于标点或换行分割 (加入 \n 以支持 Title\nBody 结构，优先问号、冒号、换行)
                        const splitIndex = findSplit(cleanViewpoint, ['？', '?', '：', ':', '\n']);

                        // 只要有分隔符 (取消字符数限制，确保能切分)
                        if (splitIndex > -1) {
                          // 基础切分
                          let part1 = cleanViewpoint.substring(0, splitIndex).trim();
                          let part2 = cleanViewpoint.substring(splitIndex + 1).trim();

                          // 获取分隔符类型
                          const delimiter = cleanViewpoint[splitIndex];
                          const isQuestion = ['？', '?'].includes(delimiter);

                          // @USER_REQUEST: "只有提问没有答案的要文章中，不要做修改"
                          if (part2) {
                            // 有答案
                            if (isQuestion) {
                              // 情况A：提问 + 回答
                              // @USER_REQUEST: "就是会答了什么问题，才叫核心观点" -> 意味着回答部分才是核心观点
                              // 策略：交换展示。标题使用回答部分，描述显示原问题作为背景
                              title = part2;

                              // 把问题保留在描述中 (保留问号)
                              desc = part1 + delimiter;
                            } else {
                              // 情况B：陈述 + 详情 (冒号/换行)
                              // 正常顺序：标题 = 前半部分，描述 = 后半部分
                              title = part1;
                              desc = part2;

                              // 常规清理标题 (去语气词)
                              title = title
                                .replace(/为什么/g, '')
                                .replace(/什么/g, '')
                                .replace(/怎么/g, '')
                                .replace(/吗/g, '')
                                .replace(/[？\?]/g, '')
                                .trim();
                            }

                            // 防止标题清理后为空 (兜底)
                            if (!title) title = isQuestion ? part2 : part1;
                          } else {
                            // 只有提问没有答案：保留原样
                            title = part1 + (['\n'].includes(delimiter) ? '' : delimiter);
                          }

                        } else {
                          // 2. 兜底：如果没有显式分隔符，尝试用第一个标点符号强行分割
                          const firstPunctuation = findSplit(cleanViewpoint, ['，', ',', '。', '.', ';', '；']);
                          if (firstPunctuation > -1 && firstPunctuation < cleanViewpoint.length - 1) {
                            let rawTitle = cleanViewpoint.substring(0, firstPunctuation).trim();
                            // 陈述句清理
                            title = rawTitle
                              .replace(/为什么/g, '')
                              .replace(/什么/g, '')
                              .replace(/怎么/g, '')
                              .replace(/吗/g, '')
                              .trim();
                            desc = cleanViewpoint.substring(firstPunctuation + 1).trim();
                          }
                        }

                        return (
                          <div key={index} className="relative pl-10 group">
                            {/* 单段连接线 - 仅在非最后一个元素显示，或者根据设计图每一段都有一条向下的线 */}
                            {/* 单段连接线 - 每一段都有一条向下的线 */}
                            <div className="absolute left-[15px] top-8 bottom-[-32px] w-[2px] bg-gradient-to-b from-[#E8E1D6] to-transparent"></div>

                            {/* 序号气泡 - 纯色背景 */}
                            <div className="absolute left-0 top-0 w-8 h-8 bg-[#C09464] text-white rounded-full flex items-center justify-center text-sm font-bold shadow-sm z-10 border-4 border-[#FAF7F2]">
                              {index + 1}
                            </div>

                            <ResultModule
                              id={`viewpoint-${index}`}
                              content={viewpoint}
                              onCopy={handleCopyContent}
                              isCopied={copiedId === `viewpoint-${index}`}
                              className="bg-white border-[#E8E1D6] hover:border-[#C09464] shadow-sm hover:shadow-md transition-all"
                            >
                              <div className="pr-4">
                                <h4 className="text-base font-medium text-[#2C2416] mb-3 leading-tight">{title}</h4>
                                {desc && <p className="text-[#6B5D4D] leading-relaxed text-sm">{desc}</p>}
                                {/* 纯文本回退显示 */}
                                {!desc && viewpoint.length > title.length && <p className="text-[#6B5D4D] leading-relaxed text-sm mt-2">{viewpoint.substring(title.length)}</p>}
                              </div>
                            </ResultModule>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 2. 金句摘录（第二位） */}
                {analysisResult.quotes && analysisResult.quotes.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold font-serif text-[#2C2416] mb-4 flex items-center">
                      <Quote size={20} className="mr-2 text-[#C09464]" />
                      金句摘录
                    </h3>
                    {analysisResult.quotes.map((quote, index) => (
                      <ResultModule
                        key={index}
                        id={`quote-${index}`}
                        content={quote}
                        onCopy={handleCopyContent}
                        isCopied={copiedId === `quote-${index}`}
                      >
                        <div className="flex items-start space-x-3">
                          <Quote size={20} className="text-[#C09464] mt-1 flex-shrink-0" />
                          <p className="text-[#2C2416] italic text-lg leading-relaxed font-serif">"{quote}"</p>
                        </div>
                      </ResultModule>
                    ))}
                  </div>
                )}

                {/* 3. 关键概念（第三位） */}
                {analysisResult.concepts && analysisResult.concepts.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold font-serif text-[#2C2416] mb-4 flex items-center">
                      <Tag size={20} className="mr-2 text-[#E5A853]" />
                      关键概念
                    </h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      {analysisResult.concepts.map((concept, index) => (
                        <ResultModule
                          key={index}
                          id={`concept-${index}`}
                          content={`${concept.term}: ${concept.definition}`}
                          onCopy={handleCopyContent}
                          isCopied={copiedId === `concept-${index}`}
                        >
                          <div>
                            <h4 className="font-semibold font-serif text-[#2C2416] mb-2">{concept.term}</h4>
                            <p className="text-[#6B5D4D] text-sm leading-relaxed">{concept.definition}</p>
                          </div>
                        </ResultModule>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* 原文内嵌视图 - 直接在当前页面显示原文 */}
            {currentView === 'originalView' && showOriginalUrl && (
              <div className="max-w-4xl mx-auto">
                {/* 加载预览内容的逻辑组件 */}
                <PreviewLogicV2
                  url={showOriginalUrl}
                  onHtmlLoaded={setPreviewHtml}
                  setLoading={setIsPreviewLoading}
                />

                {/* 原文内容区域 - 直接渲染到页面，使用浏览器滚动条 */}
                {previewHtml ? (
                  <div
                    className="original-article-content prose prose-lg max-w-none"
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      const selectedText = window.getSelection()?.toString().trim() || '';
                      setContextMenu({
                        visible: true,
                        x: e.clientX,
                        y: e.clientY,
                        selectedText
                      });
                    }}
                    style={{
                      fontFamily: "'Noto Serif SC', 'Songti SC', Georgia, serif",
                      fontSize: '17px',
                      lineHeight: '1.9',
                      color: '#2C2416'
                    }}
                  />

                ) : (
                  <div className="w-full h-96 flex flex-col items-center justify-center text-[#9A8C7B] space-y-4">
                    {isPreviewLoading ? (
                      <div className="text-center">
                        <div className="w-12 h-12 border-3 border-[#C09464] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p>正在加载原文内容...</p>
                      </div>
                    ) : (
                      <>
                        <div className="p-4 bg-[#FFEBEE] rounded-full text-[#C85A5A]">
                          <AlertTriangle size={32} />
                        </div>
                        <p>无法加载原文内容</p>
                        <a
                          href={showOriginalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-6 py-2 bg-[#C09464] text-white rounded-lg hover:bg-[#A87D4F] transition-colors"
                        >
                          在浏览器中打开
                        </a>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 相关文章视图 */}
            {currentView === 'related' && (
              <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold font-serif text-[#2C2416]">相关文章推荐</h3>
                  <button
                    onClick={() => setCurrentView('result')}
                    className="px-4 py-2 bg-[#F0EBE3] hover:bg-[#E8E1D6] text-[#6B5D4D] rounded-lg transition-colors"
                  >
                    返回分析结果
                  </button>
                </div>
                <div className="space-y-4">
                  {currentRelatedArticles.map((article) => (
                    <div
                      key={article.id}
                      className="bg-white border border-[#E8E1D6] rounded-xl p-6 hover:shadow-lg transition-all duration-200 cursor-pointer group"
                      onClick={() => {
                        setSelectedArticle(article);
                        setCurrentView('processing');
                        setIsProcessing(true);
                        setTimeout(() => {
                          setAnalysisResult({
                            ...MOCK_RESULTS_DB.default,
                            title: article.title,
                            author: article.source,
                            summary: article.summary
                          });
                          setCurrentRelatedArticles(MOCK_RESULTS_DB.default.related_articles);
                          setIsProcessing(false);
                          setCurrentView('result');
                        }, 1000);
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            {article.status === 'pending' && <div className="w-2 h-2 rounded-full bg-[#E5A853]"></div>}
                            <span className="text-xs font-medium text-[#9A8C7B]">{article.source}</span>
                            <span className="text-xs text-[#B8A99A]">•</span>
                            <span className="text-xs text-[#9A8C7B]">{article.date}</span>
                          </div>
                          <h4 className="text-base font-semibold font-serif text-[#2C2416] mb-2 group-hover:text-[#C09464] transition-colors">
                            {article.title}
                          </h4>
                          <p className="text-[#6B5D4D] text-sm leading-relaxed mb-3">
                            {article.summary}
                          </p>
                          {article.quote && (
                            <div className="text-xs text-[#9A8C7B] italic border-l-2 border-[#D4C9BA] pl-3 py-1">
                              "{article.quote}"
                            </div>
                          )}
                        </div>
                        <ChevronRight size={20} className="text-[#B8A99A] group-hover:text-[#C09464] transition-colors ml-4" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 订阅管理视图 */}
            {currentView === 'subscriptions' && (
              <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-semibold font-serif text-[#2C2416]">订阅源管理</h3>

                  <div className="flex space-x-3">
                    <button
                      onClick={() => setIsAddModalOpen(true)}
                      className="px-4 py-2 bg-[#C09464] hover:bg-[#A87D4F] text-white rounded-lg transition-colors flex items-center"
                    >
                      <Plus size={16} className="mr-2" />
                      添加订阅
                    </button>
                  </div>
                </div>



                <div className="grid gap-4">
                  {subscriptions
                    .map((sub) => (
                      <div
                        key={sub.id}
                        className="bg-white border border-[#E8E1D6] rounded-xl p-6 hover:shadow-lg transition-all duration-200 group"
                      >
                        <div className="flex items-center justify-between">
                          <div
                            className="flex-1 cursor-pointer"
                            onClick={() => { setCurrentView('inbox'); setSelectedFeedId(sub.id); }}
                          >
                            <div className="flex items-center space-x-3 mb-2">
                              <h4 className="text-lg font-semibold font-serif text-[#2C2416] group-hover:text-[#C09464] transition-colors">{sub.name}</h4>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${sub.status === 'active' ? 'bg-[#E8F5E9] text-[#558B2F]' :
                                sub.status === 'error' ? 'bg-[#FFEBEE] text-[#C62828]' :
                                  'bg-[#FFF8E1] text-[#F57F17]'
                                }`}>
                                {sub.status === 'active' ? '活跃' : sub.status === 'error' ? '错误' : '同步中'}
                              </span>
                              {sub.healthStatus && (
                                <span className={`w-2 h-2 rounded-full ml-2 ${sub.healthStatus === 'healthy' ? 'bg-green-400' :
                                  sub.healthStatus === 'warning' ? 'bg-yellow-400' :
                                    'bg-red-400'
                                  }`} title={`健康状态: ${sub.healthStatus === 'healthy' ? '健康' : sub.healthStatus === 'warning' ? '警告' : '严重'}`}>
                                </span>
                              )}
                              {sub.category && (
                                <span className="text-xs text-[#9A8C7B] bg-[#F5F1EB] px-2 py-0.5 rounded ml-2">
                                  {sub.category}
                                </span>
                              )}
                            </div>
                            <p className="text-[#9A8C7B] text-sm mb-2">{sub.rssUrl}</p>
                            <div className="flex items-center space-x-4 text-xs text-[#B8A99A]">
                              <span>更新频率：{sub.frequency}</span>
                              <span>•</span>
                              <span>最后更新：{
                                (() => {
                                  // 从收件箱中找到该订阅源的最新文章
                                  const subArticles = inboxItems.filter(item => item.source === sub.name);
                                  if (subArticles.length > 0) {
                                    return subArticles[0].date; // 返回最新文章的时间
                                  }
                                  return sub.last_fetch || '暂无文章';
                                })()
                              }</span>
                              <span>•</span>
                              <span>文章数：{inboxItems.filter(item => item.source === sub.name).length}</span>
                            </div>
                            {sub.errorMsg && (
                              <p className="text-[#C85A5A] text-sm mt-2">{sub.errorMsg}</p>
                            )}
                          </div>
                          <div className="flex space-x-2 items-center pl-4 border-l border-[#E8E1D6] ml-4 relative z-10">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleStartEditSubscription(sub); }}
                              className="p-2 text-[#9A8C7B] hover:text-[#C09464] hover:bg-[#F5F1EB] rounded-lg transition-all"
                              title="编辑"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleShowDeleteConfirm(sub); }}
                              className="p-3 text-[#9A8C7B] hover:text-[#C85A5A] hover:bg-[#FFEBEE] rounded-lg cursor-pointer"
                              title="删除"
                            >
                              <Trash2 size={18} />
                            </button>
                            <div
                              className="cursor-pointer p-1"
                              onClick={() => { setCurrentView('inbox'); setSelectedFeedId(sub.id); }}
                            >
                              <ChevronRight size={20} className="text-[#B8A99A] group-hover:text-[#C09464] transition-colors ml-2" />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* 知识图谱视图 (SVG 版) */}
            {currentView === 'graph' && (
              <div className="max-w-6xl mx-auto">
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold font-serif text-[#2C2416]">知识图谱</h3>
                    <div className="flex space-x-3">
                      <div className="relative">
                        <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#9A8C7B]" />
                        <input
                          type="text"
                          placeholder="搜索概念或书籍..."
                          value={graphSearch}
                          onChange={(e) => setGraphSearch(e.target.value)}
                          className="pl-10 pr-4 py-2 bg-white border border-[#E8E1D6] rounded-lg text-[#2C2416] placeholder-[#B8A99A] focus:ring-2 focus:ring-[#C09464] focus:border-[#C09464] outline-none"
                        />
                      </div>
                      <button
                        onClick={() => {
                          setEditingNodeId(null);
                          setNewNodeLabel('');
                          setNewNodeDesc('');
                          setNewNodeParent('');
                          setIsAddNodeModalOpen(true);
                        }}
                        className="px-4 py-2 bg-[#C09464] hover:bg-[#A87D4F] text-white rounded-lg transition-colors"
                      >
                        <Plus size={16} className="mr-2 inline" />
                        添加节点
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex gap-6 h-[600px] relative">
                  {/* SVG 画布容器 */}
                  <div className="flex-1 bg-[#FAF7F2] border border-[#E8E1D6] rounded-xl relative overflow-hidden shadow-inner">
                    <svg
                      ref={svgRef}
                      className="w-full h-full cursor-grab active:cursor-grabbing"
                    >
                      <defs>
                        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                          <feGaussianBlur stdDeviation="2" result="blur" />
                          <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                      </defs>

                      {/* 连线层 */}
                      <g className="links transition-opacity duration-300">
                        {graphLinks.map((link, index) => {
                          const safeSource = typeof link.source === 'object' ? link.source.id : link.source;
                          const safeTarget = typeof link.target === 'object' ? link.target.id : link.target;

                          // Initial render relies on graphNodes positions. D3 will takeover via class selection.
                          // Find node in graphNodes to get initial X/Y
                          const sourceNode = graphNodes.find(n => n.id === safeSource);
                          const targetNode = graphNodes.find(n => n.id === safeTarget);

                          if (!sourceNode || !targetNode) return null;

                          // 搜索模式下，如果节点不匹配，连线变淡
                          const isDimmed = graphSearch && (
                            !sourceNode.label.toLowerCase().includes(graphSearch.toLowerCase()) &&
                            !targetNode.label.toLowerCase().includes(graphSearch.toLowerCase())
                          );

                          return (
                            <line
                              key={`${safeSource}-${safeTarget}-${index}`} // Use safe IDs
                              x1={sourceNode.x}
                              y1={sourceNode.y}
                              x2={targetNode.x}
                              y2={targetNode.y}
                              stroke={isDimmed ? "#E8E1D6" : "#AFA090"}
                              strokeWidth={link.dashed ? 1.5 : 2}
                              strokeDasharray={link.dashed ? "5,5" : "none"}
                              className="link-line transition-all duration-300" // Add class for D3
                            />
                          );
                        })}
                      </g>

                      {/* 节点层 */}
                      <g className="nodes">
                        {graphNodes.map((node) => {
                          // 搜索高亮逻辑
                          const isMatch = !graphSearch ||
                            node.label.toLowerCase().includes(graphSearch.toLowerCase()) ||
                            node.desc.toLowerCase().includes(graphSearch.toLowerCase());

                          const isActive = selectedNode?.id === node.id;

                          // 节点半径定义
                          const radius = node.type === 'book' ? 24 : node.type === 'concept' ? 18 : 14;

                          return (
                            <g
                              key={node.id}
                              transform={`translate(${node.x},${node.y})`}
                              className={`node-group transition-all duration-300 cursor-pointer ${!isMatch ? 'opacity-20 grayscale' : 'opacity-100'}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedNode(node);
                              }}
                            >
                              {/* 节点光晕 (选中时显示) */}
                              {isActive && (
                                <circle
                                  r={radius + 8}
                                  fill="none"
                                  stroke={node.color}
                                  strokeWidth="2"
                                  strokeOpacity="0.5"
                                  className="animate-pulse"
                                />
                              )}

                              {/* 节点主体 */}
                              <circle
                                r={radius}
                                fill={node.color}
                                stroke="#1e293b"
                                strokeWidth="2"
                                style={{ filter: isActive ? 'url(#glow)' : 'none' }}
                                className="transition-all hover:scale-110"
                              />

                              {/* 图标/文字 */}
                              <text
                                dy={radius + 18}
                                textAnchor="middle"
                                fill="#2C2416"
                                className="text-xs font-medium pointer-events-none select-none"
                                style={{ fontSize: isActive ? '14px' : '12px', fontWeight: isActive ? 'bold' : 'normal' }}
                              >
                                {node.label}
                              </text>
                            </g>
                          );
                        })}
                      </g>
                    </svg>

                    {/* 图例浮层 */}
                    <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm p-3 rounded-lg border border-[#E8E1D6] flex gap-4 text-xs font-medium text-[#6B5D4D] shadow-md">
                      <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#E5A853]"></div>书籍</div>
                      <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#7CAE7A]"></div>概念</div>
                      <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#6B9AC4]"></div>笔记</div>
                    </div>
                  </div>

                  {/* 右侧详情滑板 (Knowledge Card) */}
                  <div
                    className={`w-80 bg-white border-l border-[#E8E1D6] shadow-2xl transition-all duration-300 absolute right-0 top-0 bottom-0 z-10 transform ${selectedNode ? 'translate-x-0' : 'translate-x-full'}`}
                  >
                    {selectedNode ? (
                      <div className="h-full flex flex-col">
                        {/* 卡片头部 */}
                        <div className="p-5 border-b border-[#E8E1D6] bg-white relative">
                          <div className="absolute top-4 right-4 flex items-center gap-2">
                            <button
                              onClick={() => handleStartEditNode(selectedNode)}
                              className="text-[#9A8C7B] hover:text-[#C09464] transition-colors p-1"
                              title="编辑节点"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => setSelectedNode(null)}
                              className="text-[#9A8C7B] hover:text-[#2C2416] transition-colors p-1"
                            >
                              <X size={18} />
                            </button>
                          </div>

                          <div className="flex items-center gap-2 mb-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${selectedNode.type === 'book' ? 'bg-[#FEF9E7] text-[#A87D4F]' :
                              selectedNode.type === 'concept' ? 'bg-[#E8F5E9] text-[#558B2F]' :
                                'bg-[#E3F2FD] text-[#1565C0]'
                              }`}>
                              {selectedNode.type === 'book' ? 'SOURCE' : selectedNode.type === 'concept' ? 'CONCEPT' : 'NOTE'}
                            </span>
                          </div>
                          <h3 className="text-2xl font-bold font-serif text-[#2C2416] mb-1">{selectedNode.label}</h3>
                        </div>

                        {/* 卡片内容区 */}
                        <div className="flex-1 overflow-y-auto p-5">
                          {/* 描述 */}
                          <div className="mb-6">
                            <h4 className="text-xs font-bold text-[#9A8C7B] uppercase tracking-widest mb-3 flex items-center gap-2">
                              <FileText size={12} /> 定义 / 摘要
                            </h4>
                            <p className="text-[#6B5D4D] leading-relaxed text-sm bg-[#FAF7F2] p-3 rounded-lg border border-[#E8E1D6]">
                              {selectedNode.desc}
                            </p>
                          </div>

                          {/* 关联信息 (对于概念节点或笔记节点) */}
                          {(selectedNode.parent || selectedNode.sourceUrl) && (
                            <div className="mb-6">
                              <h4 className="text-xs font-bold text-[#9A8C7B] uppercase tracking-widest mb-3 flex items-center gap-2">
                                <BookOpen size={12} /> 来源
                              </h4>
                              {selectedNode.sourceUrl ? (
                                <a
                                  href={selectedNode.sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="bg-[#FEF9E7] p-3 rounded-lg flex items-center gap-3 hover:bg-[#FCF3D9] transition-colors group"
                                >
                                  <div className="w-8 h-8 rounded bg-[#C09464] flex items-center justify-center text-white shrink-0">
                                    <FileText size={16} />
                                  </div>
                                  <div className="text-sm flex-1 min-w-0">
                                    <div className="text-[#9A8C7B] text-xs">出自文章</div>
                                    <div className="text-[#2C2416] font-medium truncate group-hover:text-[#C09464] transition-colors">
                                      {selectedNode.sourceTitle || selectedNode.sourceUrl}
                                    </div>
                                  </div>
                                  <ExternalLink size={14} className="text-[#B8A99A] group-hover:text-[#C09464] shrink-0" />
                                </a>
                              ) : (
                                <div className="bg-[#FEF9E7] p-3 rounded-lg flex items-center gap-3">
                                  <div className="w-8 h-8 rounded bg-[#C09464] flex items-center justify-center text-white shrink-0">
                                    <BookOpen size={16} />
                                  </div>
                                  <div className="text-sm">
                                    <div className="text-[#9A8C7B] text-xs">出自书籍</div>
                                    <div className="text-[#2C2416] font-medium">
                                      {graphNodes.find(n => n.id === selectedNode.parent)?.label || '未知来源'}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* AI 洞察 */}
                          <div className="mb-6">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-xs font-bold text-[#9A8C7B] uppercase tracking-widest flex items-center gap-2">
                                <Zap size={12} /> AI 洞察
                              </h4>
                              <button
                                onClick={() => generateAiInsight(selectedNode)}
                                disabled={insightLoadingNodeId === selectedNode.id}
                                className="text-xs text-[#C09464] hover:text-[#A87D4F] transition-colors flex items-center gap-1 disabled:opacity-50"
                              >
                                <RefreshCw size={12} className={insightLoadingNodeId === selectedNode.id ? 'animate-spin' : ''} />
                                {insightLoadingNodeId === selectedNode.id ? '生成中...' : '生成洞察'}
                              </button>
                            </div>
                            <div className="bg-gradient-to-br from-[#FEF9E7] to-[#FAF7F2] p-4 rounded-lg border border-[#E8E1D6]">
                              {insightLoadingNodeId === selectedNode.id ? (
                                <div className="flex items-center gap-2 text-[#9A8C7B]">
                                  <div className="w-4 h-4 border-2 border-[#C09464] border-t-transparent rounded-full animate-spin"></div>
                                  <span className="text-sm">AI 正在分析...</span>
                                </div>
                              ) : nodeInsights[selectedNode.id] ? (
                                <p className="text-sm text-[#6B5D4D] leading-relaxed whitespace-pre-line">{nodeInsights[selectedNode.id]}</p>
                              ) : (
                                <p className="text-sm text-[#9A8C7B] italic">
                                  点击"生成洞察"获取 AI 对该概念的深度分析
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 底部操作栏 */}
                        <div className="p-4 border-t border-[#E8E1D6] bg-[#FAF7F2]">
                          <button
                            onClick={openNodeChatModal}
                            className="w-full py-2.5 bg-[#C09464] hover:bg-[#A87D4F] text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-sm"
                          >
                            <MessageSquare size={16} />
                            与 AI 对话此概念
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center text-[#9A8C7B]">
                        请选择一个节点
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 智能笔记视图 */}
            {currentView === 'notes' && (
              <div className="max-w-4xl mx-auto space-y-6">
                <h3 className="text-xl font-semibold font-serif text-[#2C2416]">智能笔记</h3>

                {/* 笔记编辑器 */}
                <div className="bg-white border border-[#E8E1D6] rounded-xl p-6 shadow-sm">
                  <h4 className="text-lg font-medium font-serif text-[#2C2416] mb-4">创建新笔记</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[#6B5D4D] mb-2">笔记内容</label>
                      <textarea
                        value={noteContent}
                        onChange={(e) => setNoteContent(e.target.value)}
                        placeholder="记录你的思考、感悟或重要信息..."
                        className="w-full h-32 px-4 py-3 bg-[#FAF7F2] border border-[#E8E1D6] rounded-lg text-[#2C2416] placeholder-[#B8A99A] focus:ring-2 focus:ring-[#C09464] focus:border-[#C09464] outline-none resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#6B5D4D] mb-2">标签 (用逗号分隔)</label>
                      <input
                        type="text"
                        value={noteTags}
                        onChange={(e) => setNoteTags(e.target.value)}
                        placeholder="例如：复利, 财富, 投资"
                        className="w-full px-4 py-2 bg-[#FAF7F2] border border-[#E8E1D6] rounded-lg text-[#2C2416] placeholder-[#B8A99A] focus:ring-2 focus:ring-[#C09464] focus:border-[#C09464] outline-none"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={handleSaveNote}
                        disabled={!noteContent.trim() || isNoteSaving}
                        className="px-6 py-2 bg-[#C09464] hover:bg-[#A87D4F] disabled:bg-[#D4C9BA] disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center"
                      >
                        {isNoteSaving ? (
                          <>
                            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                            保存中...
                          </>
                        ) : (
                          <>
                            <Plus size={16} className="mr-2" />
                            保存笔记
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 笔记历史 */}
                <div className="space-y-4">
                  <h4 className="text-lg font-medium font-serif text-[#2C2416]">历史笔记</h4>
                  {notesHistory.length === 0 ? (
                    <div className="text-center py-8 text-[#9A8C7B]">
                      <StickyNote size={48} className="mx-auto mb-4 text-[#D4C9BA]" />
                      <p>还没有笔记，开始记录你的第一个想法吧！</p>
                    </div>
                  ) : (
                    notesHistory.map((note) => (
                      <div key={note.id} className="bg-white border border-[#E8E1D6] rounded-xl p-6 shadow-sm">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <p className="text-[#2C2416] leading-relaxed mb-3">{note.content}</p>
                            {note.tags.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {note.tags.map((tag, index) => (
                                  <span
                                    key={index}
                                    className="px-2 py-1 bg-[#E8D5B7] text-[#A87D4F] rounded-full text-xs"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-[#B8A99A] ml-4">{note.date}</span>
                        </div>

                        {/* 显示来源信息 */}
                        {(note.sourceUrl || note.source) && (
                          <div className="mt-3 pt-3 border-t border-[#F5F1EB] flex items-center">
                            <div className="flex items-center text-xs text-[#9A8C7B] hover:text-[#C09464] transition-colors max-w-full truncate">
                              <BookOpen size={12} className="mr-1.5 flex-shrink-0" />
                              <span className="mr-1">来源:</span>
                              {note.sourceUrl ? (
                                <a
                                  href={note.sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:underline truncate"
                                  onClick={(e) => {
                                    // 如果是原文视图的链接，尝试在应用内打开（如果有相关逻辑支持）
                                    // 这里简单处理为新窗口打开，或者触发预览
                                    if (note.sourceUrl.startsWith('http')) {
                                      // 默认行为即可
                                    }
                                  }}
                                >
                                  {note.sourceUrl}
                                </a>
                              ) : (
                                <span>{note.source || '未知来源'}</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* 手动解析视图 */}
            {currentView === 'manual' && (
              <div className="max-w-2xl mx-auto">
                <div className="bg-white border border-[#E8E1D6] rounded-xl p-6 shadow-sm">
                  <h3 className="text-xl font-semibold font-serif text-[#2C2416] mb-6">手动文章解析</h3>

                  {/* 输入类型选择 */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-[#6B5D4D] mb-3">输入方式</label>
                    <div className="flex space-x-4">
                      <button
                        onClick={() => setManualInputType('url')}
                        className={`px-4 py-2 rounded-lg transition-colors ${manualInputType === 'url'
                          ? 'bg-[#C09464] text-white'
                          : 'bg-[#F5F1EB] text-[#6B5D4D] hover:bg-[#EDE8E0]'
                          }`}
                      >
                        <Link size={16} className="mr-2 inline" />
                        URL链接
                      </button>
                      <button
                        onClick={() => setManualInputType('text')}
                        className={`px-4 py-2 rounded-lg transition-colors ${manualInputType === 'text'
                          ? 'bg-[#C09464] text-white'
                          : 'bg-[#F5F1EB] text-[#6B5D4D] hover:bg-[#EDE8E0]'
                          }`}
                      >
                        <FileText size={16} className="mr-2 inline" />
                        文本内容
                      </button>
                    </div>
                  </div>

                  {/* 输入区域 */}
                  <div className="space-y-4">
                    {manualInputType === 'url' ? (
                      <div>
                        <label className="block text-sm font-medium text-[#6B5D4D] mb-2">文章链接</label>
                        <input
                          type="url"
                          value={manualInputValue}
                          onChange={(e) => setManualInputValue(e.target.value)}
                          placeholder="https://example.com/article"
                          className="w-full px-4 py-3 bg-[#FAF7F2] border border-[#E8E1D6] rounded-lg text-[#2C2416] placeholder-[#B8A99A] focus:ring-2 focus:ring-[#C09464] focus:border-[#C09464] outline-none"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-medium text-[#6B5D4D] mb-2">文本内容</label>
                        <textarea
                          value={manualInputValue}
                          onChange={(e) => setManualInputValue(e.target.value)}
                          placeholder="粘贴或输入要分析的文章内容..."
                          className="w-full h-40 px-4 py-3 bg-[#FAF7F2] border border-[#E8E1D6] rounded-lg text-[#2C2416] placeholder-[#B8A99A] focus:ring-2 focus:ring-[#C09464] focus:border-[#C09464] outline-none resize-none"
                        />
                      </div>
                    )}

                    <button
                      onClick={handleManualAnalyze}
                      disabled={!manualInputValue.trim() || isProcessing}
                      className="w-full px-6 py-3 bg-[#C09464] hover:bg-[#A87D4F] disabled:bg-[#D4C9BA] disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center"
                    >
                      {isProcessing ? (
                        <>
                          <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                          正在解析...
                        </>
                      ) : (
                        <>
                          <Zap size={18} className="mr-2" />
                          开始智能解析
                        </>
                      )}
                    </button>
                  </div>

                  {/* 提示信息 */}
                  <div className="mt-6 p-4 bg-[#E3F2FD] border border-[#90CAF9] rounded-lg">
                    <div className="flex items-start space-x-3">
                      <Info size={18} className="text-[#1565C0] mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-[#1565C0]">
                        <p className="font-medium mb-1">智能解析功能</p>
                        <p>系统将自动提取文章的核心观点、关键概念，并生成智能摘要和金句摘录。解析结果将保存到收件箱中，方便后续查看和管理。</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div >

        {/* 添加订阅模态框 */}
        {
          isAddModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
              <div className="bg-white border border-[#E8E1D6] rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="px-6 py-4 border-b border-[#E8E1D6] flex justify-between items-center">
                  <h3 className="text-lg font-semibold font-serif text-[#2C2416]">添加新的订阅源</h3>
                  <button
                    onClick={() => setIsAddModalOpen(false)}
                    className="text-[#9A8C7B] hover:text-[#2C2416] transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[#6B5D4D] mb-2">
                      名称 / 公众号名 <span className="text-[#C85A5A]">*</span>
                    </label>
                    <input
                      type="text"
                      value={newSubName}
                      onChange={(e) => setNewSubName(e.target.value)}
                      placeholder="例如：L先生说"
                      className="w-full px-4 py-2 bg-[#FAF7F2] border border-[#E8E1D6] rounded-lg text-[#2C2416] placeholder-[#B8A99A] focus:ring-2 focus:ring-[#C09464] focus:border-[#C09464] outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#6B5D4D] mb-2">
                      RSSHub 路由 / URL <span className="text-[#C85A5A]">*</span>
                    </label>
                    <input
                      type="text"
                      value={newSubRss}
                      onChange={(e) => setNewSubRss(e.target.value)}
                      placeholder="/wechat/user/id"
                      className="w-full px-4 py-2 bg-[#FAF7F2] border border-[#E8E1D6] rounded-lg text-[#2C2416] placeholder-[#B8A99A] focus:ring-2 focus:ring-[#C09464] focus:border-[#C09464] outline-none transition-all font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#6B5D4D] mb-2">分类</label>
                    <input
                      type="text"
                      value={newSubCategory}
                      onChange={(e) => setNewSubCategory(e.target.value)}
                      placeholder="输入或从下方选择..."
                      className="w-full px-4 py-2 bg-[#FAF7F2] border border-[#E8E1D6] rounded-lg text-[#2C2416] placeholder-[#B8A99A] focus:ring-2 focus:ring-[#C09464] focus:border-[#C09464] outline-none transition-all text-sm"
                    />
                    <div className="flex flex-wrap gap-2 mt-2">
                      {['认知觉醒', '商业洞察', '科技', 'AI 工具', '个人成长'].map(cat => (
                        <button
                          key={cat}
                          onClick={() => setNewSubCategory(cat)}
                          className={`px-3 py-1 text-xs rounded-full border transition-colors ${newSubCategory === cat
                            ? 'bg-[#C09464] text-white border-[#C09464]'
                            : 'bg-[#F5F1EB] text-[#6B5D4D] border-[#E8E1D6] hover:bg-[#EDE8E0]'
                            }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-[#E8E1D6] flex justify-end space-x-3">
                  <button
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 text-[#9A8C7B] hover:text-[#2C2416] font-medium text-sm transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleAddSubscription}
                    disabled={!newSubName || !newSubRss}
                    className={`px-4 py-2 font-medium text-sm rounded-lg transition-all flex items-center ${!newSubName || !newSubRss
                      ? 'bg-[#D4C9BA] text-[#9A8C7B] cursor-not-allowed'
                      : 'bg-[#C09464] hover:bg-[#A87D4F] text-white'
                      }`}
                  >
                    <Plus size={16} className="mr-1" />
                    确认添加
                  </button>
                </div>
              </div>
            </div>
          )
        }

        {/* 添加节点模态框 */}
        {isAddNodeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white border border-[#E8E1D6] rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="px-6 py-4 border-b border-[#E8E1D6] flex justify-between items-center">
                <h3 className="text-lg font-semibold font-serif text-[#2C2416]">{editingNodeId ? '编辑节点' : '添加知识节点'}</h3>
                <button
                  onClick={() => setIsAddNodeModalOpen(false)}
                  className="text-[#9A8C7B] hover:text-[#2C2416] transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* 节点类型 */}
                <div>
                  <label className="block text-sm font-medium text-[#6B5D4D] mb-2">节点类型 <span className="text-xs text-[#9A8C7B]">（点击颜色球可更换颜色）</span></label>
                  <div className="flex flex-wrap gap-2">
                    {/* 预设类型 */}
                    {[
                      { type: 'book', label: '书籍', color: '#E5A853' },
                      { type: 'concept', label: '概念', color: '#7CAE7A' },
                      { type: 'note', label: '笔记', color: '#8B5CF6' },
                      ...customNodeTypes // 用户自定义的类型
                    ].map(item => {
                      const isSelected = newNodeType === item.type || (newNodeType === 'custom' && newNodeCustomType === item.type);
                      const displayColor = isSelected ? newNodeColor : item.color;

                      return (
                        <div
                          key={item.type}
                          className={`flex items-center px-4 py-2 rounded-lg border transition-all ${isSelected
                            ? 'border-[#C09464] bg-[#FEF9E7]'
                            : 'border-[#E8E1D6] hover:border-[#D4C9BA]'
                            }`}
                        >
                          {/* 颜色球 - 点击可选择颜色 */}
                          <label className="relative cursor-pointer group">
                            <div
                              className="w-4 h-4 rounded-full mr-2 transition-all hover:scale-125 hover:ring-2 hover:ring-[#C09464] hover:ring-offset-1"
                              style={{ backgroundColor: displayColor }}
                            />
                            <input
                              type="color"
                              value={displayColor}
                              onChange={(e) => {
                                setNewNodeColor(e.target.value);
                                setNewNodeType(item.type);
                                if (!['book', 'concept', 'note'].includes(item.type)) {
                                  setNewNodeCustomType(item.type);
                                }
                              }}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                          </label>
                          {/* 文字 - 点击选择类型 */}
                          <span
                            onClick={() => {
                              setNewNodeType(item.type);
                              setNewNodeColor(item.color);
                              if (!['book', 'concept', 'note'].includes(item.type)) {
                                setNewNodeCustomType(item.type);
                              }
                            }}
                            className="text-sm text-[#2C2416] cursor-pointer"
                          >
                            {item.label}
                          </span>
                        </div>
                      );
                    })}
                    {/* + 按钮添加新的自定义类型 */}
                    <button
                      onClick={() => {
                        setNewNodeType('custom');
                        setNewNodeCustomType('');
                      }}
                      className={`flex items-center justify-center w-10 h-10 rounded-lg border transition-all ${newNodeType === 'custom' && !customNodeTypes.some(t => t.type === newNodeCustomType)
                        ? 'border-[#C09464] bg-[#FEF9E7]'
                        : 'border-[#E8E1D6] hover:border-[#D4C9BA]'
                        }`}
                      title="添加新的自定义类型"
                    >
                      <Plus size={18} className="text-[#6B5D4D]" />
                    </button>
                  </div>
                </div>

                {/* 自定义类型输入（仅当选择自定义时显示） */}
                {newNodeType === 'custom' && (
                  <div className="bg-gradient-to-br from-[#FEF9E7] to-[#FAF7F2] border border-[#E8E1D6] rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <div
                        className="w-5 h-5 rounded-full shadow-sm"
                        style={{ backgroundColor: newNodeColor }}
                      />
                      <span className="text-sm font-medium text-[#6B5D4D]">创建新类型</span>
                    </div>

                    {/* 类型名称输入 */}
                    <div className="mb-4">
                      <label className="block text-xs font-medium text-[#9A8C7B] mb-1.5 uppercase tracking-wide">类型名称</label>
                      <input
                        type="text"
                        value={newNodeCustomType}
                        onChange={(e) => setNewNodeCustomType(e.target.value)}
                        placeholder="人物、事件、地点..."
                        className="w-full px-3 py-2.5 bg-white border border-[#E8E1D6] rounded-lg text-[#2C2416] placeholder-[#B8A99A] focus:ring-2 focus:ring-[#C09464] focus:border-[#C09464] outline-none transition-all text-sm"
                      />
                    </div>

                    {/* 颜色选择 */}
                    <div>
                      <label className="block text-xs font-medium text-[#9A8C7B] mb-2 uppercase tracking-wide">选择颜色</label>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {[
                          { color: '#E5A853', name: '琥珀' },
                          { color: '#7CAE7A', name: '翠绿' },
                          { color: '#8B5CF6', name: '紫罗兰' },
                          { color: '#3B82F6', name: '天蓝' },
                          { color: '#EF4444', name: '珊瑚红' },
                          { color: '#EC4899', name: '玫瑰' },
                          { color: '#14B8A6', name: '青碧' },
                          { color: '#F97316', name: '橙黄' }
                        ].map(item => (
                          <button
                            key={item.color}
                            onClick={() => setNewNodeColor(item.color)}
                            title={item.name}
                            className={`w-8 h-8 rounded-full transition-all duration-200 hover:scale-110 relative group ${newNodeColor === item.color
                              ? 'ring-2 ring-[#2C2416] ring-offset-2 ring-offset-[#FEF9E7] scale-110'
                              : 'hover:ring-2 hover:ring-[#C09464] hover:ring-offset-1'
                              }`}
                            style={{ backgroundColor: item.color }}
                          >
                            {newNodeColor === item.color && (
                              <Check size={14} className="absolute inset-0 m-auto text-white drop-shadow" />
                            )}
                          </button>
                        ))}
                        {/* 自定义颜色选择器 */}
                        <label className="relative cursor-pointer group">
                          <div
                            className={`w-8 h-8 rounded-full border-2 border-dashed flex items-center justify-center transition-all duration-200 hover:scale-110 ${!['#E5A853', '#7CAE7A', '#8B5CF6', '#3B82F6', '#EF4444', '#EC4899', '#14B8A6', '#F97316'].includes(newNodeColor)
                              ? 'border-[#2C2416] ring-2 ring-[#2C2416] ring-offset-2 ring-offset-[#FEF9E7]'
                              : 'border-[#9A8C7B] hover:border-[#C09464]'
                              }`}
                            style={{
                              backgroundColor: !['#E5A853', '#7CAE7A', '#8B5CF6', '#3B82F6', '#EF4444', '#EC4899', '#14B8A6', '#F97316'].includes(newNodeColor)
                                ? newNodeColor
                                : '#FAF7F2'
                            }}
                          >
                            <Plus size={12} className={`${!['#E5A853', '#7CAE7A', '#8B5CF6', '#3B82F6', '#EF4444', '#EC4899', '#14B8A6', '#F97316'].includes(newNodeColor)
                              ? 'text-white drop-shadow'
                              : 'text-[#9A8C7B]'
                              }`} />
                          </div>
                          <input
                            type="color"
                            value={newNodeColor}
                            onChange={(e) => setNewNodeColor(e.target.value)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                )}


                {/* 节点名称 */}
                <div>
                  <label className="block text-sm font-medium text-[#6B5D4D] mb-2">
                    名称 <span className="text-[#C85A5A]">*</span>
                  </label>
                  <input
                    type="text"
                    value={newNodeLabel}
                    onChange={(e) => setNewNodeLabel(e.target.value)}
                    placeholder={newNodeType === 'book' ? '书籍名称' : newNodeType === 'concept' ? '概念名称' : newNodeType === 'note' ? '笔记标题' : '节点名称'}
                    className="w-full px-4 py-2 bg-[#FAF7F2] border border-[#E8E1D6] rounded-lg text-[#2C2416] placeholder-[#B8A99A] focus:ring-2 focus:ring-[#C09464] focus:border-[#C09464] outline-none transition-all"
                  />
                </div>

                {/* 描述 */}
                <div>
                  <label className="block text-sm font-medium text-[#6B5D4D] mb-2">描述</label>
                  <textarea
                    value={newNodeDesc}
                    onChange={(e) => setNewNodeDesc(e.target.value)}
                    placeholder="简短描述..."
                    rows={2}
                    className="w-full px-4 py-2 bg-[#FAF7F2] border border-[#E8E1D6] rounded-lg text-[#2C2416] placeholder-[#B8A99A] focus:ring-2 focus:ring-[#C09464] focus:border-[#C09464] outline-none transition-all resize-none"
                  />
                </div>

                {/* 关联节点（所有类型都显示） */}
                <div>
                  <label className="block text-sm font-medium text-[#6B5D4D] mb-2">关联到</label>
                  <select
                    value={newNodeParent}
                    onChange={(e) => setNewNodeParent(e.target.value)}
                    className="w-full px-4 py-2 bg-[#FAF7F2] border border-[#E8E1D6] rounded-lg text-[#2C2416] focus:ring-2 focus:ring-[#C09464] focus:border-[#C09464] outline-none transition-all"
                  >
                    <option value="">不关联</option>
                    <optgroup label="书籍">
                      {graphNodes.filter(n => n.type === 'book').map(node => (
                        <option key={node.id} value={node.id}>{node.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="概念">
                      {graphNodes.filter(n => n.type === 'concept').map(node => (
                        <option key={node.id} value={node.id}>{node.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="其他">
                      {graphNodes.filter(n => n.type !== 'book' && n.type !== 'concept').map(node => (
                        <option key={node.id} value={node.id}>{node.label}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-[#E8E1D6] flex justify-end space-x-3">
                <button
                  onClick={() => setIsAddNodeModalOpen(false)}
                  className="px-4 py-2 text-[#9A8C7B] hover:text-[#2C2416] font-medium text-sm transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleAddGraphNode}
                  disabled={!newNodeLabel.trim()}
                  className={`px-4 py-2 font-medium text-sm rounded-lg transition-all flex items-center ${!newNodeLabel.trim()
                    ? 'bg-[#D4C9BA] text-[#9A8C7B] cursor-not-allowed'
                    : 'bg-[#C09464] hover:bg-[#A87D4F] text-white'
                    }`}
                >
                  {editingNodeId ? (
                    <>
                      <Check size={16} className="mr-1" />
                      保存修改
                    </>
                  ) : (
                    <>
                      <Plus size={16} className="mr-1" />
                      添加节点
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 设置模态框 */}
        {/* AI 概念对话模态框 */}
        {showNodeChatModal && selectedNode && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white border border-[#E8E1D6] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col" style={{ maxHeight: '80vh' }}>
              {/* 头部 */}
              <div className="px-6 py-4 border-b border-[#E8E1D6] flex justify-between items-center bg-gradient-to-r from-[#FEF9E7] to-white">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white"
                    style={{ backgroundColor: selectedNode.color || '#C09464' }}
                  >
                    <MessageSquare size={16} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold font-serif text-[#2C2416]">与 AI 对话</h3>
                    <p className="text-xs text-[#9A8C7B]">关于 "{selectedNode.label}"</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowNodeChatModal(false)}
                  className="text-[#9A8C7B] hover:text-[#2C2416] transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* 消息列表 */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#FAF7F2] min-h-[300px]">
                {nodeChatMessages.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#E8E1D6] flex items-center justify-center">
                      <Sparkles size={20} className="text-[#C09464]" />
                    </div>
                    <p className="text-sm text-[#9A8C7B]">开始与 AI 探讨 "{selectedNode.label}"</p>
                    <p className="text-xs text-[#B8A99A] mt-1">你可以询问定义、应用场景、举例等</p>
                  </div>
                ) : (
                  nodeChatMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm ${msg.role === 'user'
                          ? 'bg-[#C09464] text-white rounded-br-md'
                          : 'bg-white border border-[#E8E1D6] text-[#2C2416] rounded-bl-md shadow-sm'
                          }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))
                )}
                {isNodeChatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-[#E8E1D6] px-4 py-3 rounded-2xl rounded-bl-md shadow-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-[#C09464] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-[#C09464] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-[#C09464] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 输入框 */}
              <div className="p-4 border-t border-[#E8E1D6] bg-white">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={nodeChatInput}
                    onChange={(e) => setNodeChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendNodeChatMessage()}
                    placeholder="输入你的问题..."
                    className="flex-1 px-4 py-2.5 bg-[#FAF7F2] border border-[#E8E1D6] rounded-lg text-[#2C2416] placeholder-[#B8A99A] focus:ring-2 focus:ring-[#C09464] focus:border-[#C09464] outline-none transition-all text-sm"
                  />
                  <button
                    onClick={sendNodeChatMessage}
                    disabled={!nodeChatInput.trim() || isNodeChatLoading}
                    className="px-4 py-2.5 bg-[#C09464] hover:bg-[#A87D4F] disabled:bg-[#D4C9BA] text-white rounded-lg transition-colors flex items-center gap-1"
                  >
                    <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {
          isSettingsOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
              <div className="bg-white border border-[#E8E1D6] rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="px-6 py-4 border-b border-[#E8E1D6] flex justify-between items-center">
                  <h3 className="text-lg font-semibold font-serif text-[#2C2416]">AI 设置</h3>
                  <button
                    onClick={() => setIsSettingsOpen(false)}
                    className="text-[#9A8C7B] hover:text-[#2C2416] transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[#6B5D4D] mb-2">
                      SiliconFlow API Key <span className="text-[#C85A5A]">*</span>
                    </label>
                    <input
                      type="password"
                      value={sparkApiKey}
                      onChange={(e) => setSparkApiKey(e.target.value)}
                      placeholder="sk-..."
                      className="w-full px-4 py-2 bg-[#FAF7F2] border border-[#E8E1D6] rounded-lg text-[#2C2416] placeholder-[#B8A99A] focus:ring-2 focus:ring-[#C09464] focus:border-[#C09464] outline-none transition-all font-mono text-sm"
                    />
                  </div>

                  <div className="p-4 bg-[#E3F2FD] border border-[#90CAF9] rounded-lg">
                    <div className="flex items-start space-x-3">
                      <Info size={18} className="text-[#1565C0] mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-[#1565C0]">
                        <p className="font-medium mb-2">如何获取免费 API Key</p>
                        <ol className="list-decimal list-inside space-y-1">
                          <li>访问 <a href="https://cloud.siliconflow.cn" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#0D47A1]">硅基流动 SiliconFlow</a></li>
                          <li>注册账号（新用户有免费额度）</li>
                          <li>进入「API 密钥」页面创建密钥</li>
                          <li>复制密钥粘贴到上方输入框</li>
                        </ol>
                      </div>
                    </div>
                  </div>

                  {sparkApiKey && (
                    <div className="flex items-center space-x-2 text-[#558B2F] text-sm">
                      <Check size={16} />
                      <span>API Key 已配置</span>
                    </div>
                  )}
                </div>

                <div className="px-6 py-4 border-t border-[#E8E1D6] flex justify-end space-x-3">
                  <button
                    onClick={() => setIsSettingsOpen(false)}
                    className="px-4 py-2 text-[#9A8C7B] hover:text-[#2C2416] font-medium text-sm transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => {
                      // 保存到 localStorage
                      localStorage.setItem('spark_api_key', sparkApiKey);
                      setIsSettingsOpen(false);
                      if (sparkApiKey) {
                        alert('API Key 已保存！现在可以使用 AI 分析功能了。');
                      }
                    }}
                    className="px-4 py-2 font-medium text-sm rounded-lg transition-all flex items-center bg-[#C09464] hover:bg-[#A87D4F] text-white"
                  >
                    <Check size={16} className="mr-1" />
                    保存设置
                  </button>
                </div>
              </div>
            </div>
          )
        }

        {/* 编辑订阅模态框 */}
        {
          editingSubscription && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
              <div className="bg-white border border-[#E8E1D6] rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="px-6 py-4 border-b border-[#E8E1D6] flex justify-between items-center">
                  <h3 className="text-lg font-semibold font-serif text-[#2C2416]">编辑订阅</h3>
                  <button
                    onClick={() => setEditingSubscription(null)}
                    className="text-[#9A8C7B] hover:text-[#2C2416] transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[#6B5D4D] mb-2">
                      订阅名称 <span className="text-[#C85A5A]">*</span>
                    </label>
                    <input
                      type="text"
                      value={editSubName}
                      onChange={(e) => setEditSubName(e.target.value)}
                      placeholder="输入订阅名称"
                      className="w-full px-4 py-2 bg-[#FAF7F2] border border-[#E8E1D6] rounded-lg text-[#2C2416] placeholder-[#B8A99A] focus:ring-2 focus:ring-[#C09464] focus:border-[#C09464] outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#6B5D4D] mb-2">
                      RSS 地址 <span className="text-[#C85A5A]">*</span>
                    </label>
                    <input
                      type="text"
                      value={editSubRss}
                      onChange={(e) => setEditSubRss(e.target.value)}
                      placeholder="https://example.com/feed.xml"
                      className="w-full px-4 py-2 bg-[#FAF7F2] border border-[#E8E1D6] rounded-lg text-[#2C2416] placeholder-[#B8A99A] focus:ring-2 focus:ring-[#C09464] focus:border-[#C09464] outline-none transition-all font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#6B5D4D] mb-2">分类</label>
                    <input
                      type="text"
                      value={editSubCategory}
                      onChange={(e) => setEditSubCategory(e.target.value)}
                      placeholder="输入分类"
                      className="w-full px-4 py-2 bg-[#FAF7F2] border border-[#E8E1D6] rounded-lg text-[#2C2416] placeholder-[#B8A99A] focus:ring-2 focus:ring-[#C09464] focus:border-[#C09464] outline-none transition-all text-sm"
                    />
                    <div className="flex flex-wrap gap-2 mt-2">
                      {['认知觉醒', '商业洞察', '科技', 'AI 工具', '个人成长'].map(cat => (
                        <button
                          key={cat}
                          onClick={() => setEditSubCategory(cat)}
                          className={`px-3 py-1 text-xs rounded-full border transition-colors ${editSubCategory === cat
                            ? 'bg-[#C09464] text-white border-[#C09464]'
                            : 'bg-[#F5F1EB] text-[#6B5D4D] border-[#E8E1D6] hover:bg-[#EDE8E0]'
                            }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-[#E8E1D6] flex justify-end space-x-3">
                  <button
                    onClick={() => setEditingSubscription(null)}
                    className="px-4 py-2 text-[#9A8C7B] hover:text-[#2C2416] font-medium text-sm transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSaveEditSubscription}
                    disabled={!editSubName || !editSubRss}
                    className={`px-4 py-2 font-medium text-sm rounded-lg transition-all flex items-center ${!editSubName || !editSubRss
                      ? 'bg-[#D4C9BA] text-[#9A8C7B] cursor-not-allowed'
                      : 'bg-[#C09464] hover:bg-[#A87D4F] text-white'
                      }`}
                  >
                    <Check size={16} className="mr-1" />
                    保存修改
                  </button>
                </div>
              </div>
            </div>
          )
        }



        {/* 删除确认模态框 */}
        {
          confirmModal.isOpen && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-white border border-[#E8E1D6] rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-12 h-12 bg-[#FFEBEE] rounded-full flex items-center justify-center">
                    <Trash2 size={24} className="text-[#C85A5A]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold font-serif text-[#2C2416]">确认删除</h3>
                    <p className="text-[#9A8C7B] text-sm">此操作无法撤销</p>
                  </div>
                </div>
                <p className="text-[#6B5D4D] mb-6">
                  确定要删除订阅源 <span className="text-[#2C2416] font-medium">"{confirmModal.subName}"</span> 吗？
                </p>
                <div className="flex space-x-3 justify-end">
                  <button
                    onClick={handleCancelDelete}
                    className="px-4 py-2 bg-[#F0EBE3] hover:bg-[#E8E1D6] text-[#6B5D4D] rounded-lg transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleConfirmDelete}
                    className="px-4 py-2 bg-[#C85A5A] hover:bg-[#B74A4A] text-white rounded-lg transition-colors"
                  >
                    确认删除
                  </button>
                </div>
              </div>
            </div>
          )
        }

        {/* 右键菜单组件 */}
        {contextMenu.visible && (
          <div
            className="fixed bg-white border border-[#E8E1D6] rounded-lg shadow-xl py-2 z-[100] min-w-[160px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleContextMenuWriteNote}
              className="w-full px-4 py-2.5 text-left text-[#2C2416] hover:bg-[#FAF7F2] flex items-center transition-colors"
            >
              <StickyNote size={16} className="mr-3 text-[#8B5CF6]" />
              写笔记
            </button>
            {contextMenu.selectedText && (
              <button
                onClick={handleContextMenuExcerpt}
                className="w-full px-4 py-2.5 text-left text-[#2C2416] hover:bg-[#FAF7F2] flex items-center transition-colors"
              >
                <Quote size={16} className="mr-3 text-[#6B9AC4]" />
                摘录文本
              </button>
            )}
          </div>
        )}

        {/* 阅读笔记弹窗 */}
        {noteModal.visible && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-[#E8E1D6] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
              {/* 弹窗标题 */}
              <div className="px-6 py-4 border-b border-[#E8E1D6] flex justify-between items-center">
                <h3 className="text-lg font-semibold font-serif text-[#2C2416] flex items-center">
                  {noteModal.isExcerpt ? (
                    <><Quote size={20} className="mr-2 text-[#6B9AC4]" />摘录文本</>
                  ) : (
                    <><StickyNote size={20} className="mr-2 text-[#8B5CF6]" />写笔记</>
                  )}
                </h3>
                <button
                  onClick={() => setNoteModal({ visible: false, excerpt: '', isExcerpt: false })}
                  className="text-[#9A8C7B] hover:text-[#2C2416] transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* 弹窗内容 */}
              <div className="p-6 space-y-4">
                {/* 节点类型选择 */}
                <div>
                  <label className="block text-sm font-medium text-[#6B5D4D] mb-2">
                    节点类型 <span className="text-xs text-[#9A8C7B]">（点击颜色球可更换颜色）</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { type: 'book', label: '书籍', color: '#E5A853' },
                      { type: 'concept', label: '概念', color: '#7CAE7A' },
                      { type: 'note', label: '笔记', color: '#8B5CF6' },
                      ...customNodeTypes
                    ].map(item => {
                      const isSelected = readerNoteType === item.type || (readerNoteType === 'custom' && readerNoteCustomType === item.type);

                      return (
                        <div
                          key={item.type}
                          className={`flex items-center px-3 py-1.5 rounded-lg border transition-all ${isSelected
                            ? 'border-[#C09464] bg-[#FEF9E7]'
                            : 'border-[#E8E1D6] hover:border-[#D4C9BA]'
                            }`}
                        >
                          <button
                            onClick={() => {
                              if (['book', 'person', 'concept', 'note'].includes(item.type)) {
                                setReaderNoteType(item.type);
                                setReaderNoteCustomType('');
                              } else {
                                setReaderNoteType('custom');
                                setReaderNoteCustomType(item.type);
                              }
                              setReaderNoteColor(item.color);
                            }}
                            className={`text-xs mr-2 ${isSelected ? 'text-[#C09464] font-medium' : 'text-[#6B5D4D]'}`}
                          >
                            {item.label}
                          </button>
                          <div className="relative w-4 h-4">
                            <div
                              className="w-4 h-4 rounded-full shadow-sm"
                              style={{ backgroundColor: isSelected ? readerNoteColor : item.color }}
                            />
                            {isSelected && (
                              <input
                                type="color"
                                value={readerNoteColor}
                                onChange={(e) => setReaderNoteColor(e.target.value)}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* 自定义类型按钮 */}
                    <button
                      onClick={() => {
                        setReaderNoteType('custom');
                        setReaderNoteCustomType('');
                        setReaderNoteColor('#8B5CF6'); // Default custom color
                      }}
                      className={`px-3 py-1.5 rounded-lg border flex items-center justify-center transition-all ${readerNoteType === 'custom' && !readerNoteCustomType
                        ? 'border-[#C09464] bg-[#FEF9E7] text-[#C09464]'
                        : 'border-[#E8E1D6] text-[#9A8C7B]'
                        }`}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                {/* 自定义类型名称输入 */}
                {readerNoteType === 'custom' && !customNodeTypes.some(t => t.type === readerNoteCustomType) && (
                  <div>
                    <input
                      type="text"
                      value={readerNoteCustomType}
                      onChange={(e) => setReaderNoteCustomType(e.target.value)}
                      placeholder="输入新类型名称..." // User needs to type a name for the new type
                      className="w-full px-4 py-2 bg-[#FAF7F2] border border-[#E8E1D6] rounded-lg text-[#2C2416] text-sm focus:border-[#C09464] outline-none"
                    />
                  </div>
                )}

                {/* 节点名称输入 */}
                <div>
                  <label className="block text-sm font-medium text-[#6B5D4D] mb-2">
                    名称 <span className="text-[#C85A5A]">*</span>
                  </label>
                  <input
                    type="text"
                    value={readerNoteName}
                    onChange={(e) => setReaderNoteName(e.target.value)}
                    className="w-full px-4 py-2 bg-[#FAF7F2] border border-[#E8E1D6] rounded-lg text-[#2C2416] text-sm focus:border-[#C09464] outline-none"
                  />
                </div>

                {/* 笔记内容 (Existing) */}
                <div>
                  <label className="block text-sm font-medium text-[#6B5D4D] mb-2">
                    {noteModal.isExcerpt ? '摘录内容' : '笔记内容'}
                  </label>
                  <textarea
                    value={readerNoteContent}
                    onChange={(e) => setReaderNoteContent(e.target.value)}
                    placeholder={noteModal.isExcerpt ? '已自动填入选中的文本...' : '记录你的思考、感悟或重要信息...'}
                    className="w-full h-32 px-4 py-3 bg-[#FAF7F2] border border-[#E8E1D6] rounded-lg text-[#2C2416] placeholder-[#B8A99A] focus:ring-2 focus:ring-[#C09464] focus:border-[#C09464] outline-none resize-none"
                  />
                </div>

                {/* 标签输入 */}
                <div>
                  <label className="block text-sm font-medium text-[#6B5D4D] mb-2">
                    标签 (用逗号分隔)
                  </label>
                  <input
                    type="text"
                    value={readerNoteTags}
                    onChange={(e) => setReaderNoteTags(e.target.value)}
                    placeholder="例如：复利, 财富, 投资"
                    className="w-full px-4 py-2 bg-[#FAF7F2] border border-[#E8E1D6] rounded-lg text-[#2C2416] placeholder-[#B8A99A] focus:ring-2 focus:ring-[#C09464] focus:border-[#C09464] outline-none"
                  />
                </div>

                {/* 知识图谱概念推荐 */}
                <div>
                  <label className="block text-sm font-medium text-[#6B5D4D] mb-2 flex items-center">
                    <Network size={14} className="mr-1" />
                    参考知识图谱概念 (点击添加为标签)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {graphNodes
                      .filter(n => n.type === 'concept')
                      .slice(0, 8)
                      .map((concept) => (
                        <button
                          key={concept.id}
                          onClick={() => {
                            const currentTags = readerNoteTags.trim();
                            const newTag = concept.label;
                            if (currentTags.includes(newTag)) return;
                            setReaderNoteTags(currentTags ? `${currentTags}, ${newTag}` : newTag);
                          }}
                          className="px-3 py-1 bg-[#E8F5E9] text-[#558B2F] rounded-full text-xs hover:bg-[#C8E6C9] transition-colors"
                        >
                          {concept.label}
                        </button>
                      ))}
                  </div>
                </div>

                {/* 来源链接 */}
                {showOriginalUrl && (
                  <div>
                    <label className="block text-sm font-medium text-[#6B5D4D] mb-2 flex items-center">
                      <BookOpen size={14} className="mr-1" />
                      来源
                    </label>
                    <a
                      href={showOriginalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 bg-[#FEF9E7] p-3 rounded-lg hover:bg-[#FCF3D9] transition-colors group"
                    >
                      <div className="w-8 h-8 rounded bg-[#C09464] flex items-center justify-center text-white shrink-0">
                        <ExternalLink size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[#9A8C7B] text-xs">出自文章</div>
                        <div className="text-[#2C2416] font-medium text-sm truncate group-hover:text-[#C09464] transition-colors">
                          {analysisResult?.title || '原文链接'}
                        </div>
                      </div>
                      <ExternalLink size={14} className="text-[#B8A99A] group-hover:text-[#C09464] shrink-0" />
                    </a>
                  </div>
                )}
              </div>


              {/* 弹窗操作栏 */}
              <div className="px-6 py-4 border-t border-[#E8E1D6] flex justify-end space-x-3 bg-[#FAF7F2]">
                <button
                  onClick={() => setNoteModal({ visible: false, excerpt: '', isExcerpt: false })}
                  className="px-4 py-2 text-[#9A8C7B] hover:text-[#2C2416] font-medium text-sm transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveNoteFromReader}
                  disabled={!readerNoteContent.trim()}
                  className={`px-4 py-2 font-medium text-sm rounded-lg transition-all flex items-center ${!readerNoteContent.trim()
                    ? 'bg-[#D4C9BA] text-[#9A8C7B] cursor-not-allowed'
                    : 'bg-[#C09464] hover:bg-[#A87D4F] text-white'
                    }`}
                >
                  <Check size={16} className="mr-1" />
                  保存到知识图谱
                </button>
              </div>
            </div>
          </div>
        )}


      </div >

    </div >

  );
};

// 结果模块组件
const ResultModule = ({ children, id, content, onCopy, isCopied, className = "bg-white" }) => {
  return (
    <div
      className={`group relative p-6 rounded-xl border border-[#E8E1D6] shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer ${className}`}
      onClick={() => onCopy(content, id)}
    >
      <div className="pr-12">
        {children}
      </div>
      <div
        className={`absolute top-4 right-4 p-2 rounded-lg transition-all ${isCopied ? 'bg-[#E8F5E9] text-[#558B2F] opacity-100' : 'bg-[#FAF7F2] text-[#B8A99A] opacity-0 group-hover:opacity-100 hover:bg-[#E8D5B7] hover:text-[#C09464]'
          }`}
        title="点击复制"
      >
        {isCopied ? <Check size={16} /> : <Copy size={16} />}
      </div>
    </div>
  );
};

// 侧边栏组件
const SidebarItem = ({ icon, label, badge, active }) => (
  <div className={`flex items-center justify-between px-4 py-2.5 rounded-lg cursor-pointer transition-all mb-1 mx-2 ${active ? 'bg-[#C09464] text-white shadow-md' : 'text-[#6B5D4D] hover:bg-[#EDE8E0] hover:text-[#2C2416]'
    }`}>
    <div className="flex items-center">
      <div className={`mr-3 ${active ? 'text-white' : 'text-[#9A8C7B]'}`}>{icon}</div>
      <span className="font-medium text-sm">{label}</span>
    </div>
    {badge > 0 && (
      <span className="bg-[#C85A5A] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
        {badge}
      </span>
    )}
  </div>
);

const SidebarHeader = ({ title }) => (
  <div className="px-6 mt-4 mb-2 text-[10px] font-bold text-[#9A8C7B] uppercase tracking-wider">
    {title}
  </div>
);

const StatCard = ({ label, value, icon, isError }) => (
  <div className={`p-4 rounded-xl border transition-colors ${isError ? 'border-[#FFCDD2] bg-[#FFEBEE]' : 'border-[#E8E1D6] bg-white'
    }`}>
    <div className="flex items-center justify-between">
      <div>
        <div className="text-[#9A8C7B] text-xs font-medium uppercase tracking-wide mb-1">{label}</div>
        <div className={`text-xl font-bold ${isError ? 'text-[#C85A5A]' : 'text-[#2C2416]'}`}>{value}</div>
      </div>
      <div className={`p-2 rounded-full ${isError ? 'bg-[#FFCDD2]' : 'bg-[#F5F1EB]'}`}>
        {icon}
      </div>
    </div>
  </div>
);

export default SkillAdminPanel;