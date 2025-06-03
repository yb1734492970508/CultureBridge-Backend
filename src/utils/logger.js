/**
 * 日志工具模块
 * 用于企业级文化交流解决方案的日志记录
 */

/**
 * 简单日志记录器
 */
class Logger {
  /**
   * 记录信息日志
   * @param {string} message - 日志消息
   * @param {Object} data - 附加数据
   */
  info(message, data = {}) {
    this.log('INFO', message, data);
  }

  /**
   * 记录错误日志
   * @param {string} message - 日志消息
   * @param {Object} data - 附加数据
   */
  error(message, data = {}) {
    this.log('ERROR', message, data);
  }

  /**
   * 记录警告日志
   * @param {string} message - 日志消息
   * @param {Object} data - 附加数据
   */
  warn(message, data = {}) {
    this.log('WARN', message, data);
  }

  /**
   * 记录调试日志
   * @param {string} message - 日志消息
   * @param {Object} data - 附加数据
   */
  debug(message, data = {}) {
    if (process.env.DEBUG) {
      this.log('DEBUG', message, data);
    }
  }

  /**
   * 记录日志
   * @param {string} level - 日志级别
   * @param {string} message - 日志消息
   * @param {Object} data - 附加数据
   */
  log(level, message, data) {
    const timestamp = new Date().toISOString();
    const logData = {
      timestamp,
      level,
      message,
      ...data
    };
    
    console.log(JSON.stringify(logData));
  }
}

module.exports = new Logger();
