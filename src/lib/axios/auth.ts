import { loginSchema, subscribeSchema } from "@/schemas/zod";
import z from "zod";
import { Api, handleAxiosError } from "./instance";
import useSessionStore from "@/store/session-store";

class Auth {
  subscribe = async (
    values: z.infer<typeof subscribeSchema>
  ): Promise<{ message: string } | undefined> => {
    try {
      const parsed = subscribeSchema.safeParse(values);
      if (!parsed.success) throw parsed.error;

      const response = await Api.post("/auth/subs", parsed.data);
      if (response.status >= 400) throw response;
      return response.data;
    } catch (error) {
      return handleAxiosError(error);
    }
  };

  login = async (values: z.infer<typeof loginSchema>) => {
    try {
      const parsed = loginSchema.safeParse(values);
      if (!parsed.success) throw parsed.error;

      const response = await Api.post("/auth/login", parsed.data);
      if (response.status >= 400) throw response;

      if (response.data.user) {
        useSessionStore.getState().setUser(response.data.user);
      }

      return response.data;
    } catch (error) {
      return handleAxiosError(error);
    }
  };

  getSession = async () => {
    try {
      const response = await Api.get("/auth/get-session");
      if (response.status >= 400) throw response;

      const { user } = response.data;
      if (user) {
        useSessionStore.getState().setUser(user);
      }

      return response.data;
    } catch (error) {
      return handleAxiosError(error);
    }
  };

  createUser = async (values: z.infer<typeof subscribeSchema>) => {
    try {
      const parsed = subscribeSchema.safeParse(values);
      if (!parsed.success) throw parsed.error;

      const response = await Api.post("/auth/create-user", parsed.data);
      if (response.status >= 400) throw response;

      return response.data;
    } catch (error) {
      return handleAxiosError(error);
    }
  };
}

export const auth = new Auth();
