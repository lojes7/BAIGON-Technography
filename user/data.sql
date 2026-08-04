--- ADMIN
INSERT INTO users (id, name, password, role, uid) VALUES (1,'管理员','$2b$12$5u5NsXnt3x6cADRcAW8U5uWLUb61MoTBt3mKOyOtyKRylVn7sJvmO','ADMIN','admin');

--- DATA_REVIEWER
INSERT INTO users (id, name, password, role, uid) VALUES (3,'数据审核员','$2b$12$5u5NsXnt3x6cADRcAW8U5uWLUb61MoTBt3mKOyOtyKRylVn7sJvmO','DATA_REVIEWER','reviewer');

--- DATA_ANALYST
INSERT INTO users (id, name, password, role, uid) VALUES (4,'数据分析师','$2b$12$5u5NsXnt3x6cADRcAW8U5uWLUb61MoTBt3mKOyOtyKRylVn7sJvmO','DATA_ANALYST','analyst');

--- university
INSERT INTO universities (id, name) VALUES (1,'常州工学院');

--- school
INSERT INTO schools (id, name, university_id) VALUES (1,'计算机信息工程学院',1);

--- departments
INSERT INTO departments (id, name, school_id) VALUES (1,'软件工程',1);   