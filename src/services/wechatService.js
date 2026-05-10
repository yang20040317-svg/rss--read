/**
 * WeChat Download API 服务封装
 */

// [FIX] 打包后的 Electron 环境没有 Vite proxy，需要直连后端
const isElectron = window.location.protocol === 'file:';
const BASE_URL = isElectron ? 'http://127.0.0.1:5000' : '/api/wechat';

export const wechatService = {
  /**
   * 检查服务状态与登录状态
   */
  async checkHealth() {
    try {
      const response = await fetch(`${BASE_URL}/api/health`);
      const contentType = response.headers.get('content-type');
      
      if (!response.ok || !contentType || !contentType.includes('application/json')) {
        return { status: 'offline', detail: `连接失败 (${response.status})`, login_status: false };
      }
      
      const data = await response.json();
      // 后端平铺格式: {"status": "healthy", "login_status": true, "nickname": "...", "expire_time": ...}
      return {
        status: data.status === 'healthy' ? 'online' : 'offline',
        isLoggedIn: data.login_status === true,
        nickname: data.nickname || '',
        expireTime: data.expire_time || null,
        lastCheck: new Date().toLocaleTimeString()
      };
    } catch (error) {
      console.error('Check Health Error:', error);
      return { status: 'offline', detail: error.message, login_status: false };
    }
  },

  /**
   * 搜索公众号获取 FakeID
   * @param {string} query 公众号名称关键词
   */
  async searchOfficialAccount(query) {
    try {
      const response = await fetch(`${BASE_URL}/api/public/searchbiz?query=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error('搜索失败');
      const data = await response.json();
      return data.data?.list || []; // 返回包含 fakeid, nickname, alias, round_head_img 的列表
    } catch (error) {
      console.error('WeChat Search Error:', error);
      throw error;
    }
  },

  /**
   * 获取指定公众号的文章列表
   * @param {string} fakeid 公众号唯一标识
   * @param {number} begin 起始索引
   * @param {number} count 获取数量
   */
  async getArticles(fakeid, begin = 0, count = 10) {
    try {
      const response = await fetch(`${BASE_URL}/api/public/articles?fakeid=${fakeid}&begin=${begin}&count=${count}`);
      if (!response.ok) throw new Error('获取文章列表失败');
      const data = await response.json();
      return data.data?.articles || []; // 返回文章列表
    } catch (error) {
      console.error('WeChat Fetch Articles Error:', error);
      throw error;
    }
  },

  /**
   * 获取文章完整内容解析
   * @param {string} url 微信文章链接
   */
  async getArticleDetail(url) {
    try {
      const response = await fetch(`${BASE_URL}/api/article`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      if (!response.ok) throw new Error('解析文章失败');
      const data = await response.json();
      return data.data || data; // 兼容不同版本的返回格式
    } catch (error) {
      console.error('WeChat Article Detail Error:', error);
      throw error;
    }
  },

  /**
   * 添加 RSS 订阅到后端（使其开始轮询）
   */
  async subscribe(account) {
    try {
      const response = await fetch(`${BASE_URL}/api/rss/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fakeid: account.fakeid,
          nickname: account.nickname,
          alias: account.alias,
          head_img: account.round_head_img
        })
      });
      return await response.json();
    } catch (error) {
      console.error('WeChat Subscribe Error:', error);
      throw error;
    }
  },

  /**
   * 取消 RSS 订阅（使其停止轮询）
   */
  async unsubscribe(fakeid) {
    try {
      const response = await fetch(`${BASE_URL}/api/rss/unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fakeid })
      });
      return await response.json();
    } catch (error) {
      console.error('WeChat Unsubscribe Error:', error);
      throw error;
    }
  },

  /**
   * 获取所有 RSS 订阅
   */
  async getSubscriptions() {
    try {
      const response = await fetch(`${BASE_URL}/api/rss/subscriptions`);
      if (!response.ok) throw new Error('获取订阅列表失败');
      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('WeChat Fetch Subscriptions Error:', error);
      throw error;
    }
  },

  /**
   * 获取 RSS 订阅链接
   */
  getRssUrl(fakeid) {
    return `${window.location.origin}${BASE_URL}/api/rss/${fakeid}`;
  },

  /**
   * 图片代理转换（解决防盗链）
   */
  getProxyImageUrl(rawUrl) {
    if (!rawUrl) return '';
    if (rawUrl.startsWith('http')) {
      return `${BASE_URL}/api/image/proxy?url=${encodeURIComponent(rawUrl)}`;
    }
    return rawUrl;
  },

  /**
   * AI 代理请求（解决前端直接调用时的 Failed to fetch 问题）
   */
  async aiAnalyze(params) {
    try {
      const response = await fetch(`${BASE_URL}/api/ai/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: params.content,
          api_key: params.api_key,
          base_url: params.base_url,
          model: params.model,
          prompt: params.prompt
        })
      });
      
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || `AI 服务错误 (${response.status})`);
      }
      return data.data;
    } catch (error) {
      console.error('WeChat AI Analyze Error:', error);
      throw error;
    }
  }
};
