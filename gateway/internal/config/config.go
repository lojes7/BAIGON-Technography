// 百工谱 — gateway_service 配置管理

package config

import (
	"os"
	"strconv"
)

// Config 网关配置
type Config struct {
	Port        int
	Hostname    string
	ConsulAddr  string
	JWTSecret   string
	JWTExpHours int
}

// Load 从环境变量加载配置
func Load() *Config {
	return &Config{
		Port:        getEnvInt("GATEWAY_PORT", 8080),
		Hostname:    getEnv("HOSTNAME", "0.0.0.0"),
		ConsulAddr:  getEnv("CONSUL_ADDR", "localhost:8500"),
		JWTSecret:   os.Getenv("JWT_SECRET"), // 必须从环境变量注入
		JWTExpHours: getEnvInt("JWT_EXPIRATION_HOURS", 1),
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

func getEnvInt(key string, defaultVal int) int {
	if val := os.Getenv(key); val != "" {
		if i, err := strconv.Atoi(val); err == nil {
			return i
		}
	}
	return defaultVal
}
