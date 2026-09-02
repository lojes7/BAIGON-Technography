// 百工谱 — 七级目录 REST 文档契约
package catalog

type DisciplineCategoryData struct {
	ID   int64  `json:"id"`
	Code string `json:"code"`
	Name string `json:"name"`
}

type MajorCategoryData struct {
	ID                   int64  `json:"id"`
	Code                 string `json:"code"`
	Name                 string `json:"name"`
	DisciplineCategoryID int64  `json:"disciplineCategoryId"`
}

type MajorData struct {
	ID              int64  `json:"id"`
	Code            string `json:"code"`
	Name            string `json:"name"`
	MajorCategoryID int64  `json:"majorCategoryId"`
	IsEmbed         bool   `json:"isEmbed"`
}

type OccupationMajorCategoryData struct {
	ID   int64  `json:"id"`
	Code string `json:"code"`
	Name string `json:"name"`
}

type OccupationSubCategoryData struct {
	ID                        int64  `json:"id"`
	Code                      string `json:"code"`
	Name                      string `json:"name"`
	OccupationMajorCategoryID int64  `json:"occupationMajorCategoryId"`
}

type OccupationCategoryData struct {
	ID                      int64  `json:"id"`
	Code                    string `json:"code"`
	Name                    string `json:"name"`
	OccupationSubCategoryID int64  `json:"occupationSubCategoryId"`
}

type OccupationData struct {
	ID                   int64  `json:"id"`
	Code                 string `json:"code"`
	Name                 string `json:"name"`
	OccupationCategoryID int64  `json:"occupationCategoryId"`
	IsEmbed              bool   `json:"isEmbed"`
	Description          string `json:"description"`
}

type DisciplineCategoryLookupData struct {
	Items      []DisciplineCategoryData `json:"items"`
	MissingIDs []int64                  `json:"missingIds"`
}

type MajorCategoryLookupData struct {
	Items      []MajorCategoryData `json:"items"`
	MissingIDs []int64             `json:"missingIds"`
}

type MajorLookupData struct {
	Items      []MajorData `json:"items"`
	MissingIDs []int64     `json:"missingIds"`
}

type OccupationMajorCategoryLookupData struct {
	Items      []OccupationMajorCategoryData `json:"items"`
	MissingIDs []int64                       `json:"missingIds"`
}

type OccupationSubCategoryLookupData struct {
	Items      []OccupationSubCategoryData `json:"items"`
	MissingIDs []int64                     `json:"missingIds"`
}

type OccupationCategoryLookupData struct {
	Items      []OccupationCategoryData `json:"items"`
	MissingIDs []int64                  `json:"missingIds"`
}

type OccupationLookupData struct {
	Items      []OccupationData `json:"items"`
	MissingIDs []int64          `json:"missingIds"`
}
