package router

import (
	"testing"

	"github.com/gin-gonic/gin"
)

func TestRegisterOccupationRoutesIncludesSkillRelationEndpoints(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	RegisterOccupationRoutes(engine.Group("/api"), nil, "test-secret")

	want := map[string]bool{
		"POST /api/auth/occupation/skills/lookup":                                false,
		"GET /api/auth/occupation/skills/:id":                                    false,
		"POST /api/auth/occupation/skills/:id/relations/:direction":              false,
		"DELETE /api/auth/occupation/skills/:id/relations/:direction/:relatedId": false,
	}
	for _, route := range engine.Routes() {
		key := route.Method + " " + route.Path
		if _, exists := want[key]; exists {
			want[key] = true
		}
	}
	for route, registered := range want {
		if !registered {
			t.Errorf("missing route %s", route)
		}
	}
}
