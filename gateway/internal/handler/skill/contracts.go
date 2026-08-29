// 百工谱 — 规范技能 REST 文档契约
package skill

// SkillData 是规范技能本体，不包含父子关系。
type SkillData struct {
	ID      int64  `json:"id"`
	Name    string `json:"name"`
	IsEmbed bool   `json:"isEmbed"`
}

// SkillLookupData 是规范技能批量详情数据。
type SkillLookupData struct {
	Items      []SkillData `json:"items"`
	MissingIDs []int64     `json:"missingIds"`
}
