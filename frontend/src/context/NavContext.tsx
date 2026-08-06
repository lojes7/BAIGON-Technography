import { useNavigate } from "react-router-dom";

/** 兼容旧代码的导航 hook，内部使用 React Router */
const useNav = () => {
  const navigate = useNavigate();
  return (id: string) => navigate(id === "dashboard" ? "/" : `/${id}`);
};

export { useNav };
